import "server-only";
import { and, eq, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  contacts,
  invoices,
  opportunities,
  payments,
  proposals,
  serviceDeliveries,
  tasks,
} from "@/db/schema";
import type { PaymentStatus, TaskKind } from "@/db/enums";
import { logEvent } from "./events";
import { followUpSettings } from "./settings";
import { toNumber } from "./money";
import { addDays, startOfDay } from "./dates";
import { computeLeadScore } from "./scoring";

/**
 * Reglas del CRM. La idea es que el usuario no tenga que recordar el siguiente
 * paso: cuando un estado cambia, el sistema crea la tarea que toca.
 *
 * Todas las tareas automaticas llevan autoKey, que es unico en la base: si la
 * regla se dispara dos veces no aparecen dos pendientes iguales.
 */

export async function ensureTask(input: {
  autoKey: string;
  title: string;
  kind: TaskKind;
  dueAt: Date | null;
  responsibleId: string | null;
  contactId?: string | null;
  companyId?: string | null;
  opportunityId?: string | null;
  invoiceId?: string | null;
  proposalId?: string | null;
  waitingFor?: "ninguno" | "cliente" | "propuesta" | "pago";
  notes?: string | null;
  isDemo?: boolean;
}): Promise<boolean> {
  const db = await getDb();
  const existing = await db
    .select({ id: tasks.id, status: tasks.status })
    .from(tasks)
    .where(eq(tasks.autoKey, input.autoKey))
    .limit(1);
  // Si ya se atendio o se cancelo, la regla no la vuelve a abrir.
  if (existing.length > 0) return false;

  await db.insert(tasks).values({
    title: input.title,
    kind: input.kind,
    dueAt: input.dueAt,
    responsibleId: input.responsibleId,
    contactId: input.contactId ?? null,
    companyId: input.companyId ?? null,
    opportunityId: input.opportunityId ?? null,
    invoiceId: input.invoiceId ?? null,
    proposalId: input.proposalId ?? null,
    waitingFor: input.waitingFor ?? "ninguno",
    notes: input.notes ?? null,
    autoKey: input.autoKey,
    isDemo: input.isDemo ?? false,
  });
  return true;
}

// ───────────── Estado financiero derivado ─────────────

/**
 * Recalcula los estados de facturacion y pago de un negocio a partir de sus
 * facturas y pagos. El saldo no se guarda en ningun lado: se deriva, para que
 * no existan dos cifras distintas del mismo dinero.
 */
export async function recalcOpportunityFinance(opportunityId: string): Promise<void> {
  const db = await getDb();
  const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, opportunityId)).limit(1);
  if (!opp) return;

  const oppInvoices = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.opportunityId, opportunityId), isNull(invoices.deletedAt)));
  const oppPayments = await db
    .select()
    .from(payments)
    .where(and(eq(payments.opportunityId, opportunityId), isNull(payments.deletedAt)));

  // Facturacion: gana el estado mas avanzado, salvo anulada o vencida.
  let billingStatus = opp.billingStatus;
  if (oppInvoices.length > 0) {
    const statuses = oppInvoices.map((i) => i.status);
    if (statuses.includes("vencida")) billingStatus = "vencida";
    else if (statuses.includes("enviada")) billingStatus = "enviada";
    else if (statuses.includes("emitida")) billingStatus = "emitida";
    else if (statuses.includes("pendiente")) billingStatus = "pendiente";
    else if (statuses.every((s) => s === "anulada")) billingStatus = "anulada";
  }

  const totalDue = oppInvoices.length
    ? oppInvoices
        .filter((i) => i.status !== "anulada")
        .reduce((acc, i) => acc + toNumber(i.amount) * (1 + toNumber(i.taxRate) / 100), 0)
    : toNumber(opp.amount) * (1 + toNumber(opp.taxRate) / 100);

  const paid = oppPayments
    .filter((p) => p.paidOn !== null && p.status !== "reembolsado")
    .reduce((acc, p) => acc + toNumber(p.amount), 0);

  const today = startOfDay(new Date());
  const hasOverdue = oppPayments.some(
    (p) => !p.paidOn && p.expectedOn && startOfDay(new Date(p.expectedOn)) < today,
  );
  const invoiceOverdue = oppInvoices.some(
    (i) => i.status !== "anulada" && i.dueDate && startOfDay(new Date(i.dueDate)) < today,
  );
  const refunded = oppPayments.length > 0 && oppPayments.every((p) => p.status === "reembolsado");

  let paymentStatus: PaymentStatus;
  if (refunded) paymentStatus = "reembolsado";
  else if (totalDue > 0 && paid >= totalDue - 0.5) paymentStatus = "pagado";
  else if (paid > 0 && (hasOverdue || invoiceOverdue)) paymentStatus = "vencido";
  else if (paid > 0) paymentStatus = "parcial";
  else if (hasOverdue || invoiceOverdue) paymentStatus = "vencido";
  else if (oppPayments.length > 0 || oppInvoices.length > 0) paymentStatus = "pendiente";
  else paymentStatus = "no-vencido";

  // Cada pago individual tambien se pone al dia.
  for (const p of oppPayments) {
    const next: PaymentStatus = p.status === "reembolsado"
      ? "reembolsado"
      : p.paidOn
        ? "pagado"
        : p.expectedOn && startOfDay(new Date(p.expectedOn)) < today
          ? "vencido"
          : "pendiente";
    if (next !== p.status) {
      await db.update(payments).set({ status: next, updatedAt: new Date() }).where(eq(payments.id, p.id));
    }
  }

  // Facturas vencidas: si paso la fecha y queda saldo, se marca vencida.
  if (paid < totalDue - 0.5) {
    for (const inv of oppInvoices) {
      if (inv.status === "anulada" || inv.status === "no-requiere") continue;
      if (inv.dueDate && startOfDay(new Date(inv.dueDate)) < today && inv.status !== "vencida") {
        await db.update(invoices).set({ status: "vencida", updatedAt: new Date() }).where(eq(invoices.id, inv.id));
        billingStatus = "vencida";
      }
    }
  }

  if (billingStatus !== opp.billingStatus || paymentStatus !== opp.paymentStatus) {
    await db
      .update(opportunities)
      .set({ billingStatus, paymentStatus, updatedAt: new Date() })
      .where(eq(opportunities.id, opportunityId));
  }
}

/** Saldo de un negocio: total a cobrar, pagado y pendiente. */
export function balanceOf(input: {
  amount: string | number;
  taxRate: string | number;
  invoices: { amount: string | number; taxRate: string | number; status: string }[];
  payments: { amount: string | number; paidOn: string | null; status: string }[];
}): { total: number; paid: number; outstanding: number } {
  const total = input.invoices.length
    ? input.invoices
        .filter((i) => i.status !== "anulada")
        .reduce((acc, i) => acc + toNumber(i.amount) * (1 + toNumber(i.taxRate) / 100), 0)
    : toNumber(input.amount) * (1 + toNumber(input.taxRate) / 100);
  const paid = input.payments
    .filter((p) => p.paidOn !== null && p.status !== "reembolsado")
    .reduce((acc, p) => acc + toNumber(p.amount), 0);
  return { total, paid, outstanding: Math.max(0, total - paid) };
}

// ───────────── Reglas encadenadas ─────────────

/** Propuesta aceptada → marcar ganado si aplica y crear "Emitir factura". */
export async function onProposalAccepted(proposalId: string, userId: string | null): Promise<void> {
  const db = await getDb();
  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  if (!proposal?.opportunityId) return;

  const [opp] = await db
    .select()
    .from(opportunities)
    .where(eq(opportunities.id, proposal.opportunityId))
    .limit(1);
  if (!opp) return;

  const { getStages } = await import("./pipeline");
  const stages = await getStages();
  const wonStage = stages.find((s) => s.kind === "ganado");
  const currentStage = stages.find((s) => s.slug === opp.stage);

  const patch: Record<string, unknown> = {
    proposalStatus: "aceptada",
    updatedAt: new Date(),
  };

  // Solo se marca ganado si el negocio seguia activo: no se revive un perdido.
  if (wonStage && currentStage?.kind === "activa") {
    patch.stage = wonStage.slug;
    patch.stageChangedAt = new Date();
    patch.probability = 100;
    patch.closedAt = new Date();
  }
  if (opp.billingStatus === "no-requiere" && opp.requiresInvoice) patch.billingStatus = "pendiente";

  await db.update(opportunities).set(patch).where(eq(opportunities.id, opp.id));

  await logEvent({
    kind: "propuesta",
    title: `Propuesta ${proposal.number} aceptada`,
    amount: proposal.amount,
    currency: proposal.currency,
    contactId: opp.contactId,
    companyId: opp.companyId,
    opportunityId: opp.id,
    userId,
    isDemo: opp.isDemo,
  });

  if (opp.requiresInvoice) {
    await ensureTask({
      autoKey: `factura:${opp.id}`,
      title: `Emitir factura de ${opp.name}`,
      kind: "emitir-factura",
      dueAt: addDays(new Date(), 1),
      responsibleId: opp.responsibleId,
      contactId: opp.contactId,
      companyId: opp.companyId,
      opportunityId: opp.id,
      notes: "La propuesta fue aceptada y el cliente pidió factura electrónica.",
      isDemo: opp.isDemo,
    });
  } else {
    await ensureTask({
      autoKey: `cobro:${opp.id}`,
      title: `Confirmar pago de ${opp.name}`,
      kind: "seguimiento-pago",
      dueAt: addDays(new Date(), 2),
      responsibleId: opp.responsibleId,
      contactId: opp.contactId,
      companyId: opp.companyId,
      opportunityId: opp.id,
      waitingFor: "pago",
      isDemo: opp.isDemo,
    });
  }
}

/** Factura emitida → registrar el pago esperado. */
export async function onInvoiceIssued(invoiceId: string, userId: string | null): Promise<void> {
  const db = await getDb();
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!invoice) return;

  const existing = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(eq(payments.invoiceId, invoiceId), isNull(payments.deletedAt)))
    .limit(1);

  if (existing.length === 0) {
    const total = toNumber(invoice.amount) * (1 + toNumber(invoice.taxRate) / 100);
    await db.insert(payments).values({
      invoiceId: invoice.id,
      opportunityId: invoice.opportunityId,
      contactId: invoice.contactId,
      companyId: invoice.companyId,
      amount: total.toFixed(2),
      currency: invoice.currency,
      expectedOn: invoice.dueDate,
      status: "pendiente",
      notes: `Pago esperado de la factura ${invoice.number}`,
      createdBy: userId,
      isDemo: invoice.isDemo,
    });
  }

  await ensureTask({
    autoKey: `cobro-factura:${invoice.id}`,
    title: `Seguimiento de cobro de la factura ${invoice.number}`,
    kind: "seguimiento-pago",
    dueAt: invoice.dueDate ? new Date(invoice.dueDate) : addDays(new Date(), 15),
    responsibleId: invoice.responsibleId,
    contactId: invoice.contactId,
    companyId: invoice.companyId,
    opportunityId: invoice.opportunityId,
    invoiceId: invoice.id,
    waitingFor: "pago",
    isDemo: invoice.isDemo,
  });

  if (invoice.opportunityId) await recalcOpportunityFinance(invoice.opportunityId);
}

/** Pago completo → crear "Coordinar servicio" cuando el producto se entrega. */
export async function onPaymentSettled(opportunityId: string, userId: string | null): Promise<void> {
  await recalcOpportunityFinance(opportunityId);
  const db = await getDb();
  const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, opportunityId)).limit(1);
  if (!opp || opp.paymentStatus !== "pagado") return;

  const delivered = await db
    .select({ id: serviceDeliveries.id })
    .from(serviceDeliveries)
    .where(and(eq(serviceDeliveries.opportunityId, opportunityId), isNull(serviceDeliveries.deletedAt)))
    .limit(1);

  if (delivered.length === 0 && opp.deliveryStatus !== "completado") {
    await db.insert(serviceDeliveries).values({
      title: opp.name,
      opportunityId: opp.id,
      productId: opp.productId,
      companyId: opp.companyId,
      contactId: opp.contactId,
      status: "por-programar",
      responsibleId: opp.responsibleId,
      createdBy: userId,
      isDemo: opp.isDemo,
    });
    await db
      .update(opportunities)
      .set({ deliveryStatus: "por-programar", updatedAt: new Date() })
      .where(eq(opportunities.id, opp.id));
  }

  await ensureTask({
    autoKey: `servicio:${opp.id}`,
    title: `Coordinar servicio de ${opp.name}`,
    kind: "coordinar-servicio",
    dueAt: addDays(new Date(), 3),
    responsibleId: opp.responsibleId,
    contactId: opp.contactId,
    companyId: opp.companyId,
    opportunityId: opp.id,
    notes: "El pago quedó completo. Falta acordar fecha y logística.",
    isDemo: opp.isDemo,
  });
}

/** Propuesta enviada → seguimiento si el cliente no responde. */
export async function onProposalSent(proposalId: string): Promise<void> {
  const db = await getDb();
  const cfg = await followUpSettings();
  const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
  if (!proposal) return;

  await ensureTask({
    autoKey: `seguimiento-propuesta:${proposal.id}:v${proposal.currentVersion}`,
    title: `Hacer seguimiento a la propuesta ${proposal.number}`,
    kind: "esperar-respuesta",
    dueAt: addDays(new Date(), cfg.proposalFollowUpDays),
    responsibleId: proposal.responsibleId,
    contactId: proposal.contactId,
    companyId: proposal.companyId,
    opportunityId: proposal.opportunityId,
    proposalId: proposal.id,
    waitingFor: "propuesta",
    isDemo: proposal.isDemo,
  });
}

/**
 * Barrido de mantenimiento. Corre al abrir la aplicacion (y se puede colgar de
 * un cron) para poner vencimientos al dia sin depender de que alguien entre a
 * una pantalla en particular.
 */
export async function runMaintenance(): Promise<{
  overduePayments: number;
  overdueInvoices: number;
  proposalsExpired: number;
  tasksCreated: number;
}> {
  const db = await getDb();
  const today = startOfDay(new Date());
  const todayIso = today.toISOString().slice(0, 10);
  let tasksCreated = 0;

  // Pagos con fecha pasada y saldo abierto → vencidos.
  const overdue = await db
    .select()
    .from(payments)
    .where(
      and(
        isNull(payments.deletedAt),
        isNull(payments.paidOn),
        lt(payments.expectedOn, todayIso),
        ne(payments.status, "reembolsado"),
      ),
    );
  for (const p of overdue) {
    if (p.status !== "vencido") {
      await db.update(payments).set({ status: "vencido", updatedAt: new Date() }).where(eq(payments.id, p.id));
    }
    if (p.opportunityId) {
      const created = await ensureTask({
        autoKey: `pago-vencido:${p.id}`,
        title: "Cobrar pago vencido",
        kind: "seguimiento-pago",
        dueAt: today,
        responsibleId: null,
        contactId: p.contactId,
        companyId: p.companyId,
        opportunityId: p.opportunityId,
        invoiceId: p.invoiceId,
        waitingFor: "pago",
        isDemo: p.isDemo,
      });
      if (created) tasksCreated += 1;
    }
  }

  // Facturas vencidas.
  const overdueInvoices = await db
    .select({ id: invoices.id, opportunityId: invoices.opportunityId })
    .from(invoices)
    .where(
      and(
        isNull(invoices.deletedAt),
        lt(invoices.dueDate, todayIso),
        inArray(invoices.status, ["emitida", "enviada", "pendiente"]),
      ),
    );
  for (const inv of overdueInvoices) {
    await db.update(invoices).set({ status: "vencida", updatedAt: new Date() }).where(eq(invoices.id, inv.id));
  }

  // Propuestas con fecha de vencimiento pasada.
  const expired = await db
    .select({ id: proposals.id })
    .from(proposals)
    .where(
      and(
        isNull(proposals.deletedAt),
        lt(proposals.expiresOn, todayIso),
        inArray(proposals.status, ["enviada", "en-revision", "cambios-solicitados"]),
      ),
    );
  for (const p of expired) {
    await db.update(proposals).set({ status: "vencida", updatedAt: new Date() }).where(eq(proposals.id, p.id));
  }

  // Los negocios cuyo estado financiero quedo desfasado se recalculan.
  const affected = new Set<string>();
  for (const p of overdue) if (p.opportunityId) affected.add(p.opportunityId);
  for (const inv of overdueInvoices) if (inv.opportunityId) affected.add(inv.opportunityId);
  for (const id of affected) await recalcOpportunityFinance(id);

  return {
    overduePayments: overdue.length,
    overdueInvoices: overdueInvoices.length,
    proposalsExpired: expired.length,
    tasksCreated,
  };
}

/**
 * Recalcula el puntaje de un contacto. Si el usuario lo fijo a mano, se respeta
 * el valor manual y solo se actualiza el desglose.
 */
export async function recalcLeadScore(contactId: string): Promise<number> {
  const db = await getDb();
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId)).limit(1);
  if (!contact) return 0;

  const { companies: companiesTable, products, interactions: inter } = await import("@/db/schema");

  const [company] = contact.companyId
    ? await db.select().from(companiesTable).where(eq(companiesTable.id, contact.companyId)).limit(1)
    : [undefined];
  const [product] = contact.interestProductId
    ? await db.select().from(products).where(eq(products.id, contact.interestProductId)).limit(1)
    : [undefined];

  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      inbound: sql<number>`count(*) filter (where ${inter.direction} = 'entrada')::int`,
    })
    .from(inter)
    .where(eq(inter.contactId, contactId));

  const openOpps = await db
    .select({ amount: opportunities.amount, currency: opportunities.currency, stage: opportunities.stage })
    .from(opportunities)
    .where(and(eq(opportunities.contactId, contactId), isNull(opportunities.deletedAt)));

  const { getStages } = await import("./pipeline");
  const stages = await getStages();
  const activeSlugs = new Set(stages.filter((s) => s.kind === "activa").map((s) => s.slug));
  const { usdRate } = await (await import("./settings")).financeSettings();
  const openValue = openOpps
    .filter((o) => activeSlugs.has(o.stage))
    .reduce((acc, o) => acc + toNumber(o.amount) * (o.currency === "USD" ? usdRate : 1), 0);

  const hasProposal = await db
    .select({ id: proposals.id })
    .from(proposals)
    .where(and(eq(proposals.contactId, contactId), isNull(proposals.deletedAt)))
    .limit(1);

  const { score, factors } = computeLeadScore({
    segment: contact.segment,
    position: contact.position,
    companyName: company?.name ?? null,
    purchasingCapacity: company?.purchasingCapacity ?? null,
    interestProductName: product?.name ?? null,
    interestProductPrice: product ? toNumber(product.defaultPrice) * (product.currency === "USD" ? usdRate : 1) : null,
    hasEmail: Boolean(contact.emailNormalized),
    hasPhone: Boolean(contact.phoneNormalized),
    interactionCount: counts?.total ?? 0,
    inboundCount: counts?.inbound ?? 0,
    lastInteractionAt: contact.lastInteractionAt,
    openOpportunityValue: openValue,
    hasProposal: hasProposal.length > 0,
    createdAt: contact.createdAt,
  });

  const final = contact.leadScoreManual ?? score;
  await db
    .update(contacts)
    .set({ leadScore: final, leadScoreBreakdown: factors, updatedAt: new Date() })
    .where(eq(contacts.id, contactId));
  return final;
}
