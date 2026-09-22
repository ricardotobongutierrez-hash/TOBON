import "server-only";
import { aliasedTable, and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { companies, contacts, invoices, opportunities, payments, proposals, users } from "@/db/schema";
import { toNumber } from "@/lib/money";
import { financeSettings } from "@/lib/settings";
import { endOfMonth, endOfWeek, formatDateInput, startOfMonth, startOfWeek } from "@/lib/dates";

const responsible = aliasedTable(users, "responsable");

export type MoneyLine = {
  id: string;
  clientName: string;
  clientId: string | null;
  clientKind: "empresa" | "contacto";
  opportunityId: string | null;
  opportunityName: string | null;
  reference: string | null;
  amount: number;
  currency: string;
  amountCop: number;
  date: string | null;
  status: string;
  responsibleName: string | null;
};

/**
 * Cada KPI de Finanzas trae consigo la lista de clientes que lo componen: al
 * hacer clic el usuario ve exactamente de donde sale la cifra, no un numero
 * suelto que hay que creer.
 */
export type FinanceBucket = {
  key: string;
  label: string;
  help: string;
  totalCop: number;
  clients: number;
  tone: "verde" | "azul" | "ambar" | "rojo" | "gris";
  lines: MoneyLine[];
};

export async function financeOverview(): Promise<{
  buckets: FinanceBucket[];
  usdRate: number;
}> {
  const db = await getDb();
  const { usdRate } = await financeSettings();
  const today = new Date();
  const todayIso = formatDateInput(today);
  const weekEnd = formatDateInput(endOfWeek(today, { weekStartsOn: 1 }));
  const weekStart = formatDateInput(startOfWeek(today, { weekStartsOn: 1 }));
  const monthStart = formatDateInput(startOfMonth(today));
  const monthEnd = formatDateInput(endOfMonth(today));

  const cop = (amount: string | number, currency: string) =>
    toNumber(amount) * (currency === "USD" ? usdRate : 1);

  // Todos los pagos vivos, con su cliente y negocio.
  const paymentRows = await db
    .select({
      id: payments.id,
      amount: payments.amount,
      currency: payments.currency,
      expectedOn: payments.expectedOn,
      paidOn: payments.paidOn,
      status: payments.status,
      invoiceNumber: invoices.number,
      opportunityId: payments.opportunityId,
      opportunityName: opportunities.name,
      companyId: payments.companyId,
      companyName: companies.name,
      contactId: payments.contactId,
      contactName: contacts.fullName,
      responsibleName: responsible.name,
    })
    .from(payments)
    .leftJoin(invoices, eq(payments.invoiceId, invoices.id))
    .leftJoin(opportunities, eq(payments.opportunityId, opportunities.id))
    .leftJoin(companies, eq(payments.companyId, companies.id))
    .leftJoin(contacts, eq(payments.contactId, contacts.id))
    .leftJoin(responsible, eq(opportunities.responsibleId, responsible.id))
    .where(isNull(payments.deletedAt));

  const toLine = (r: (typeof paymentRows)[number]): MoneyLine => ({
    id: r.id,
    clientName: r.companyName ?? r.contactName ?? "Sin cliente asignado",
    clientId: r.companyId ?? r.contactId,
    clientKind: r.companyName ? "empresa" : "contacto",
    opportunityId: r.opportunityId,
    opportunityName: r.opportunityName,
    reference: r.invoiceNumber,
    amount: toNumber(r.amount),
    currency: r.currency,
    amountCop: cop(r.amount, r.currency),
    date: r.paidOn ?? r.expectedOn,
    status: r.status,
    responsibleName: r.responsibleName,
  });

  const pending = paymentRows.filter((r) => !r.paidOn && r.status !== "reembolsado");
  const overdue = pending.filter((r) => r.expectedOn && r.expectedOn < todayIso);
  const thisWeek = pending.filter(
    (r) => r.expectedOn && r.expectedOn >= weekStart && r.expectedOn <= weekEnd && r.expectedOn >= todayIso,
  );
  const paidThisMonth = paymentRows.filter(
    (r) => r.paidOn && r.paidOn >= monthStart && r.paidOn <= monthEnd && r.status !== "reembolsado",
  );

  // Facturas
  const invoiceRows = await db
    .select({
      id: invoices.id,
      number: invoices.number,
      amount: invoices.amount,
      taxRate: invoices.taxRate,
      currency: invoices.currency,
      status: invoices.status,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      opportunityId: invoices.opportunityId,
      opportunityName: opportunities.name,
      companyId: invoices.companyId,
      companyName: companies.name,
      contactId: invoices.contactId,
      contactName: contacts.fullName,
      responsibleName: responsible.name,
    })
    .from(invoices)
    .leftJoin(opportunities, eq(invoices.opportunityId, opportunities.id))
    .leftJoin(companies, eq(invoices.companyId, companies.id))
    .leftJoin(contacts, eq(invoices.contactId, contacts.id))
    .leftJoin(responsible, eq(invoices.responsibleId, responsible.id))
    .where(isNull(invoices.deletedAt));

  const invoiceLine = (r: (typeof invoiceRows)[number]): MoneyLine => {
    const gross = toNumber(r.amount) * (1 + toNumber(r.taxRate) / 100);
    return {
      id: r.id,
      clientName: r.companyName ?? r.contactName ?? "Sin cliente asignado",
      clientId: r.companyId ?? r.contactId,
      clientKind: r.companyName ? "empresa" : "contacto",
      opportunityId: r.opportunityId,
      opportunityName: r.opportunityName,
      reference: r.number,
      amount: gross,
      currency: r.currency,
      amountCop: cop(gross, r.currency),
      date: r.dueDate ?? r.issueDate,
      status: r.status,
      responsibleName: r.responsibleName,
    };
  };

  const invoicesPending = invoiceRows.filter((r) => r.status === "pendiente");
  const invoicesIssued = invoiceRows.filter((r) => ["emitida", "enviada"].includes(r.status));

  // Propuestas aceptadas que todavia no tienen factura: la fuga clasica.
  const acceptedNoInvoice = await db
    .select({
      id: proposals.id,
      number: proposals.number,
      amount: proposals.amount,
      currency: proposals.currency,
      respondedAt: proposals.respondedAt,
      opportunityId: proposals.opportunityId,
      opportunityName: opportunities.name,
      companyId: proposals.companyId,
      companyName: companies.name,
      contactId: proposals.contactId,
      contactName: contacts.fullName,
      responsibleName: responsible.name,
      requiresInvoice: opportunities.requiresInvoice,
      invoiceCount: sql<number>`(
        select count(*)::int from ${invoices}
        where ${invoices.opportunityId} = ${proposals.opportunityId} and ${invoices.deletedAt} is null
      )`,
    })
    .from(proposals)
    .leftJoin(opportunities, eq(proposals.opportunityId, opportunities.id))
    .leftJoin(companies, eq(proposals.companyId, companies.id))
    .leftJoin(contacts, eq(proposals.contactId, contacts.id))
    .leftJoin(responsible, eq(proposals.responsibleId, responsible.id))
    .where(and(isNull(proposals.deletedAt), eq(proposals.status, "aceptada")));

  const leaking = acceptedNoInvoice.filter((r) => r.invoiceCount === 0 && r.requiresInvoice !== false);

  const outstanding = pending;

  const buckets: FinanceBucket[] = [
    {
      key: "por-cobrar",
      label: "Por cobrar",
      help: "Pagos registrados que todavía no se han recibido.",
      totalCop: outstanding.reduce((a, r) => a + cop(r.amount, r.currency), 0),
      clients: new Set(outstanding.map((r) => r.companyId ?? r.contactId)).size,
      tone: "azul",
      lines: outstanding.map(toLine).sort((a, b) => b.amountCop - a.amountCop),
    },
    {
      key: "esta-semana",
      label: "Pagos pendientes esta semana",
      help: "Con fecha esperada entre hoy y el domingo.",
      totalCop: thisWeek.reduce((a, r) => a + cop(r.amount, r.currency), 0),
      clients: new Set(thisWeek.map((r) => r.companyId ?? r.contactId)).size,
      tone: "ambar",
      lines: thisWeek.map(toLine).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
    },
    {
      key: "vencidos",
      label: "Pagos vencidos",
      help: "Paso la fecha esperada y no se ha recibido el dinero.",
      totalCop: overdue.reduce((a, r) => a + cop(r.amount, r.currency), 0),
      clients: new Set(overdue.map((r) => r.companyId ?? r.contactId)).size,
      tone: "rojo",
      lines: overdue.map(toLine).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "")),
    },
    {
      key: "pagado-mes",
      label: "Pagado este mes",
      help: "Dinero efectivamente recibido en el mes en curso.",
      totalCop: paidThisMonth.reduce((a, r) => a + cop(r.amount, r.currency), 0),
      clients: new Set(paidThisMonth.map((r) => r.companyId ?? r.contactId)).size,
      tone: "verde",
      lines: paidThisMonth.map(toLine).sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
    },
    {
      key: "facturas-pendientes",
      label: "Facturas pendientes",
      help: "Hay que emitir la factura electrónica.",
      totalCop: invoicesPending.reduce((a, r) => a + cop(toNumber(r.amount), r.currency), 0),
      clients: new Set(invoicesPending.map((r) => r.companyId ?? r.contactId)).size,
      tone: "ambar",
      lines: invoicesPending.map(invoiceLine),
    },
    {
      key: "facturas-emitidas",
      label: "Facturas emitidas",
      help: "Ya se emitieron o se enviaron al cliente.",
      totalCop: invoicesIssued.reduce((a, r) => a + cop(toNumber(r.amount), r.currency), 0),
      clients: new Set(invoicesIssued.map((r) => r.companyId ?? r.contactId)).size,
      tone: "azul",
      lines: invoicesIssued.map(invoiceLine),
    },
    {
      key: "aceptadas-sin-factura",
      label: "Propuestas aceptadas sin factura",
      help: "El cliente dijo si y pidió factura, pero todavía no se emitio.",
      totalCop: leaking.reduce((a, r) => a + cop(r.amount, r.currency), 0),
      clients: new Set(leaking.map((r) => r.companyId ?? r.contactId)).size,
      tone: "rojo",
      lines: leaking.map((r) => ({
        id: r.id,
        clientName: r.companyName ?? r.contactName ?? "Sin cliente asignado",
        clientId: r.companyId ?? r.contactId,
        clientKind: (r.companyName ? "empresa" : "contacto") as "empresa" | "contacto",
        opportunityId: r.opportunityId,
        opportunityName: r.opportunityName,
        reference: r.number,
        amount: toNumber(r.amount),
        currency: r.currency,
        amountCop: cop(r.amount, r.currency),
        date: r.respondedAt ? formatDateInput(r.respondedAt) : null,
        status: "aceptada",
        responsibleName: r.responsibleName,
      })),
    },
    {
      key: "saldo-total",
      label: "Saldo pendiente total",
      help: "Todo lo que falta cobrar, vencido y no vencido.",
      totalCop: outstanding.reduce((a, r) => a + cop(r.amount, r.currency), 0),
      clients: new Set(outstanding.map((r) => r.companyId ?? r.contactId)).size,
      tone: "gris",
      lines: outstanding.map(toLine).sort((a, b) => b.amountCop - a.amountCop),
    },
  ];

  return { buckets, usdRate };
}

/** Saldo de una lista de negocios, agrupado por negocio. */
export async function balancesByOpportunity(opportunityIds: string[]) {
  if (opportunityIds.length === 0) return new Map<string, { total: number; paid: number; outstanding: number }>();
  const db = await getDb();
  const rows = await db
    .select({
      opportunityId: payments.opportunityId,
      paid: sql<string>`coalesce(sum(case when ${payments.paidOn} is not null and ${payments.status} <> 'reembolsado' then ${payments.amount} else 0 end), 0)`,
      expected: sql<string>`coalesce(sum(${payments.amount}), 0)`,
    })
    .from(payments)
    .where(isNull(payments.deletedAt))
    .groupBy(payments.opportunityId);

  const map = new Map<string, { total: number; paid: number; outstanding: number }>();
  for (const r of rows) {
    if (!r.opportunityId) continue;
    const total = toNumber(r.expected);
    const paid = toNumber(r.paid);
    map.set(r.opportunityId, { total, paid, outstanding: Math.max(0, total - paid) });
  }
  return map;
}
