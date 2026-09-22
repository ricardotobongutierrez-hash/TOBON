"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { invoices, opportunities, payments, tasks } from "@/db/schema";
import { BILLING_STATUSES, CURRENCIES, PAYMENT_METHODS, type BillingStatus } from "@/db/enums";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { logEvent } from "@/lib/events";
import { onInvoiceIssued, onPaymentSettled, recalcOpportunityFinance } from "@/lib/automation";
import { financeSettings } from "@/lib/settings";
import { parseMoneyInput, toMoneyString, toNumber } from "@/lib/money";
import { addDays, formatDateInput } from "@/lib/dates";
import { explain, fail, ok, type Result } from "./_result";
import { uploadAttachment } from "./files";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

// ─────────────────────── Facturas ───────────────────────

const invoiceSchema = z.object({
  number: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  opportunityId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  contactId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  companyId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  issueDate: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  dueDate: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  amount: z.string().default("0"),
  taxRate: z.string().default("0"),
  currency: z.enum(CURRENCIES).default("COP"),
  status: z.enum(BILLING_STATUSES).default("emitida"),
  responsibleId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  accountingNotes: z.preprocess(emptyToNull, z.string().nullable()).optional(),
});

async function nextInvoiceNumber(): Promise<string> {
  const db = await getDb();
  const cfg = await financeSettings();
  const year = new Date().getFullYear();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(invoices)
    .where(sql`${invoices.number} like ${`${cfg.invoicePrefix}-${year}-%`}`);
  return `${cfg.invoicePrefix}-${year}-${String((row?.n ?? 0) + 1).padStart(3, "0")}`;
}

export async function createInvoice(formData: FormData): Promise<Result<{ id: string }>> {
  try {
    const me = await requireUser();
    const parsed = invoiceSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
    const d = parsed.data;
    const db = await getDb();
    const cfg = await financeSettings();

    let { contactId, companyId } = d;
    let currency = d.currency;
    if (d.opportunityId) {
      const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, d.opportunityId)).limit(1);
      contactId ??= opp?.contactId ?? null;
      companyId ??= opp?.companyId ?? null;
      if (opp) currency = opp.currency;
    }

    const issueDate = d.issueDate ?? formatDateInput(new Date());
    const dueDate = d.dueDate ?? formatDateInput(addDays(new Date(issueDate), cfg.defaultPaymentTermDays));

    const [row] = await db
      .insert(invoices)
      .values({
        number: d.number?.trim() || (await nextInvoiceNumber()),
        opportunityId: d.opportunityId ?? null,
        contactId: contactId ?? null,
        companyId: companyId ?? null,
        issueDate,
        dueDate,
        amount: toMoneyString(parseMoneyInput(d.amount)),
        taxRate: String(toNumber(d.taxRate)),
        currency,
        status: d.status,
        responsibleId: d.responsibleId ?? me.id,
        accountingNotes: d.accountingNotes ?? null,
        createdBy: me.id,
      })
      .returning({ id: invoices.id, number: invoices.number });

    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      const fd = new FormData();
      fd.set("file", file);
      const up = await uploadAttachment("factura", row!.id, fd);
      if (up.ok) await db.update(invoices).set({ attachmentId: up.data.id }).where(eq(invoices.id, row!.id));
    }

    await logEvent({
      kind: "factura",
      direction: d.status === "enviada" ? "salida" : "interno",
      title: `Factura ${row!.number} ${d.status === "enviada" ? "enviada" : "emitida"}`,
      amount: d.amount,
      currency,
      contactId: contactId ?? null,
      companyId: companyId ?? null,
      opportunityId: d.opportunityId ?? null,
      userId: me.id,
      touch: false,
    });
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "crear",
      entityType: "factura",
      entityId: row!.id,
      summary: `Registro la factura ${row!.number}`,
    });

    // La tarea "Emitir factura" ya se cumplio.
    if (d.opportunityId) {
      await db
        .update(tasks)
        .set({ status: "hecha", completedAt: new Date(), completedBy: me.id, updatedAt: new Date() })
        .where(and(eq(tasks.autoKey, `factura:${d.opportunityId}`), eq(tasks.status, "abierta")));
    }

    if (["emitida", "enviada"].includes(d.status)) await onInvoiceIssued(row!.id, me.id);
    else if (d.opportunityId) await recalcOpportunityFinance(d.opportunityId);

    revalidatePath("/finanzas");
    revalidatePath("/pendientes");
    if (d.opportunityId) revalidatePath(`/negocios/${d.opportunityId}`);
    return ok({ id: row!.id });
  } catch (err) {
    return fail(explain(err));
  }
}

export async function setInvoiceStatus(id: string, status: BillingStatus): Promise<Result> {
  try {
    const me = await requireUser();
    const db = await getDb();
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!invoice) return fail("Esa factura ya no existe");

    await db.update(invoices).set({ status, updatedAt: new Date() }).where(eq(invoices.id, id));
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: status === "anulada" ? "anular" : "actualizar",
      entityType: "factura",
      entityId: id,
      summary: `Factura ${invoice.number}: ${status}`,
      changes: [{ field: "Estado", from: invoice.status, to: status }],
    });
    await logEvent({
      kind: "factura",
      title: `Factura ${invoice.number}: ${status}`,
      contactId: invoice.contactId,
      companyId: invoice.companyId,
      opportunityId: invoice.opportunityId,
      userId: me.id,
      touch: false,
    });

    if (["emitida", "enviada"].includes(status)) await onInvoiceIssued(id, me.id);
    if (invoice.opportunityId) await recalcOpportunityFinance(invoice.opportunityId);

    revalidatePath("/finanzas");
    if (invoice.opportunityId) revalidatePath(`/negocios/${invoice.opportunityId}`);
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function archiveInvoice(id: string): Promise<Result> {
  try {
    const me = await requireUser();
    const db = await getDb();
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!invoice) return fail("Esa factura ya no existe");
    await db.update(invoices).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(invoices.id, id));
    await db.update(payments).set({ deletedAt: new Date() }).where(and(eq(payments.invoiceId, id), isNull(payments.paidOn)));
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "eliminar",
      entityType: "factura",
      entityId: id,
      summary: `Elimino la factura ${invoice.number}`,
    });
    if (invoice.opportunityId) await recalcOpportunityFinance(invoice.opportunityId);
    revalidatePath("/finanzas");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

// ─────────────────────── Pagos ───────────────────────

const paymentSchema = z.object({
  invoiceId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  opportunityId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  contactId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  companyId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  amount: z.string().default("0"),
  currency: z.enum(CURRENCIES).default("COP"),
  expectedOn: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  paidOn: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  method: z.preprocess(emptyToNull, z.enum(PAYMENT_METHODS).nullable()).optional(),
  reference: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  notes: z.preprocess(emptyToNull, z.string().nullable()).optional(),
});

export async function createPayment(formData: FormData): Promise<Result<{ id: string }>> {
  try {
    const me = await requireUser();
    const parsed = paymentSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
    const d = parsed.data;
    const amount = parseMoneyInput(d.amount);
    if (amount <= 0) return fail("El valor del pago tiene que ser mayor que cero", "amount");
    const db = await getDb();

    let { contactId, companyId, opportunityId } = d;
    let currency = d.currency;
    if (d.invoiceId) {
      const [inv] = await db.select().from(invoices).where(eq(invoices.id, d.invoiceId)).limit(1);
      opportunityId ??= inv?.opportunityId ?? null;
      contactId ??= inv?.contactId ?? null;
      companyId ??= inv?.companyId ?? null;
      if (inv) currency = inv.currency;
    } else if (opportunityId) {
      const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, opportunityId)).limit(1);
      contactId ??= opp?.contactId ?? null;
      companyId ??= opp?.companyId ?? null;
      if (opp) currency = opp.currency;
    }

    const [row] = await db
      .insert(payments)
      .values({
        invoiceId: d.invoiceId ?? null,
        opportunityId: opportunityId ?? null,
        contactId: contactId ?? null,
        companyId: companyId ?? null,
        amount: toMoneyString(amount),
        currency,
        expectedOn: d.expectedOn ?? null,
        paidOn: d.paidOn ?? null,
        method: d.method ?? null,
        reference: d.reference ?? null,
        status: d.paidOn ? "pagado" : "pendiente",
        notes: d.notes ?? null,
        createdBy: me.id,
      })
      .returning({ id: payments.id });

    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      const fd = new FormData();
      fd.set("file", file);
      const up = await uploadAttachment("pago", row!.id, fd);
      if (up.ok) {
        await db.update(payments).set({ receiptAttachmentId: up.data.id }).where(eq(payments.id, row!.id));
      }
    }

    if (d.paidOn) {
      await logEvent({
        kind: "pago",
        direction: "entrada",
        title: "Pago recibido",
        amount: toMoneyString(amount),
        currency,
        occurredAt: new Date(d.paidOn),
        contactId: contactId ?? null,
        companyId: companyId ?? null,
        opportunityId: opportunityId ?? null,
        userId: me.id,
        touch: false,
      });
    }
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "crear",
      entityType: "pago",
      entityId: row!.id,
      summary: d.paidOn ? `Registro un pago recibido de ${amount}` : `Registro un pago esperado de ${amount}`,
    });

    if (opportunityId) await onPaymentSettled(opportunityId, me.id);

    revalidatePath("/finanzas");
    revalidatePath("/pendientes");
    if (opportunityId) revalidatePath(`/negocios/${opportunityId}`);
    return ok({ id: row!.id });
  } catch (err) {
    return fail(explain(err));
  }
}

/** Marcar un pago esperado como recibido. */
export async function settlePayment(id: string, formData: FormData): Promise<Result> {
  try {
    const me = await requireUser();
    const db = await getDb();
    const [payment] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
    if (!payment) return fail("Ese pago ya no existe");

    const paidOn = (formData.get("paidOn") as string) || formatDateInput(new Date());
    const rawAmount = formData.get("amount");
    const amount = rawAmount ? parseMoneyInput(String(rawAmount)) : toNumber(payment.amount);
    if (amount <= 0) return fail("El valor del pago tiene que ser mayor que cero", "amount");
    const method = (formData.get("method") as string) || payment.method;

    // Si pagan menos de lo esperado, el saldo queda como un pago pendiente aparte.
    const expected = toNumber(payment.amount);
    const partial = amount < expected - 0.5;

    await db
      .update(payments)
      .set({
        amount: toMoneyString(amount),
        paidOn,
        method,
        reference: (formData.get("reference") as string) || payment.reference,
        status: "pagado",
        updatedAt: new Date(),
      })
      .where(eq(payments.id, id));

    if (partial) {
      await db.insert(payments).values({
        invoiceId: payment.invoiceId,
        opportunityId: payment.opportunityId,
        contactId: payment.contactId,
        companyId: payment.companyId,
        amount: toMoneyString(expected - amount),
        currency: payment.currency,
        expectedOn: payment.expectedOn,
        status: "pendiente",
        notes: "Saldo pendiente del pago parcial",
        createdBy: me.id,
        isDemo: payment.isDemo,
      });
    }

    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      const fd = new FormData();
      fd.set("file", file);
      const up = await uploadAttachment("pago", id, fd);
      if (up.ok) await db.update(payments).set({ receiptAttachmentId: up.data.id }).where(eq(payments.id, id));
    }

    await logEvent({
      kind: "pago",
      direction: "entrada",
      title: partial ? "Pago parcial recibido" : "Pago recibido",
      amount: toMoneyString(amount),
      currency: payment.currency,
      occurredAt: new Date(paidOn),
      contactId: payment.contactId,
      companyId: payment.companyId,
      opportunityId: payment.opportunityId,
      userId: me.id,
      touch: false,
    });
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "actualizar",
      entityType: "pago",
      entityId: id,
      summary: `Confirmo un pago de ${amount}`,
      changes: [{ field: "Estado", from: payment.status, to: "pagado" }],
    });

    // Cobrado: los seguimientos de cobro se cierran.
    if (payment.opportunityId) {
      await db
        .update(tasks)
        .set({ status: "hecha", completedAt: new Date(), completedBy: me.id, updatedAt: new Date() })
        .where(and(eq(tasks.autoKey, `pago-vencido:${id}`), eq(tasks.status, "abierta")));
      await onPaymentSettled(payment.opportunityId, me.id);
    }

    revalidatePath("/finanzas");
    revalidatePath("/pendientes");
    if (payment.opportunityId) revalidatePath(`/negocios/${payment.opportunityId}`);
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function updatePaymentAmount(id: string, amountRaw: string): Promise<Result> {
  try {
    const me = await requireUser();
    const amount = parseMoneyInput(amountRaw);
    if (amount <= 0) return fail("El valor tiene que ser mayor que cero");
    const db = await getDb();
    const [payment] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
    if (!payment) return fail("Ese pago ya no existe");

    await db.update(payments).set({ amount: toMoneyString(amount), updatedAt: new Date() }).where(eq(payments.id, id));
    // Cambiar un monto de dinero siempre queda en la bitacora.
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "actualizar",
      entityType: "pago",
      entityId: id,
      summary: "Modificó el valor de un pago",
      changes: [{ field: "Valor", from: payment.amount, to: toMoneyString(amount) }],
    });
    if (payment.opportunityId) await recalcOpportunityFinance(payment.opportunityId);
    revalidatePath("/finanzas");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function deletePayment(id: string): Promise<Result> {
  try {
    const me = await requireUser();
    const db = await getDb();
    const [payment] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
    if (!payment) return fail("Ese pago ya no existe");
    await db.update(payments).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(payments.id, id));
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "eliminar",
      entityType: "pago",
      entityId: id,
      summary: `Elimino un pago de ${payment.amount} ${payment.currency}`,
    });
    if (payment.opportunityId) await recalcOpportunityFinance(payment.opportunityId);
    revalidatePath("/finanzas");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function refundPayment(id: string, reason: string): Promise<Result> {
  try {
    const me = await requireUser();
    const db = await getDb();
    const [payment] = await db.select().from(payments).where(eq(payments.id, id)).limit(1);
    if (!payment) return fail("Ese pago ya no existe");
    await db
      .update(payments)
      .set({
        status: "reembolsado",
        notes: [payment.notes, `Reembolsado: ${reason}`].filter(Boolean).join("\n"),
        updatedAt: new Date(),
      })
      .where(eq(payments.id, id));
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "reembolsar",
      entityType: "pago",
      entityId: id,
      summary: `Reembolso un pago de ${payment.amount}: ${reason}`,
    });
    if (payment.opportunityId) await recalcOpportunityFinance(payment.opportunityId);
    revalidatePath("/finanzas");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function paymentsOf(opportunityId: string) {
  const db = await getDb();
  return db
    .select()
    .from(payments)
    .where(and(eq(payments.opportunityId, opportunityId), isNull(payments.deletedAt)))
    .orderBy(desc(payments.expectedOn));
}

export async function invoicesOf(opportunityId: string) {
  const db = await getDb();
  return db
    .select()
    .from(invoices)
    .where(and(eq(invoices.opportunityId, opportunityId), isNull(invoices.deletedAt)))
    .orderBy(desc(invoices.issueDate));
}
