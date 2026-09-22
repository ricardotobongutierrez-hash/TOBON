"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { contacts, opportunities, products, tasks } from "@/db/schema";
import { CURRENCIES, DELIVERY_STATUSES, SEGMENTS } from "@/db/enums";
import { requireUser } from "@/lib/auth";
import { diffRecords, logAudit } from "@/lib/audit";
import { logEvent } from "@/lib/events";
import { recalcLeadScore, recalcOpportunityFinance, ensureTask } from "@/lib/automation";
import { getStages } from "@/lib/pipeline";
import { parseMoneyInput, toMoneyString } from "@/lib/money";
import { addDays } from "@/lib/dates";
import { explain, fail, ok, type Result } from "./_result";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const oppSchema = z.object({
  name: z.string().trim().min(2, "Ponle un nombre al negocio"),
  contactId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  companyId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  segment: z.enum(SEGMENTS).default("b2b"),
  productId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  amount: z.string().optional().default("0"),
  currency: z.enum(CURRENCIES).default("COP"),
  requiresInvoice: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()).default(false),
  stage: z.string().default("nuevo-lead"),
  probability: z.coerce.number().min(0).max(100).optional(),
  expectedCloseOn: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  responsibleId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  sourceId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  campaignId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  notes: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  // Primer paso: ningun negocio activo deberia nacer sin siguiente accion.
  nextActionTitle: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  nextActionDate: z.preprocess(emptyToNull, z.string().nullable()).optional(),
});

async function taxRateFor(requiresInvoice: boolean): Promise<string> {
  if (!requiresInvoice) return "0";
  const { financeSettings } = await import("@/lib/settings");
  const cfg = await financeSettings();
  return String(cfg.ivaRate);
}

export async function createOpportunity(formData: FormData): Promise<Result<{ id: string }>> {
  try {
    const me = await requireUser();
    const parsed = oppSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
    const d = parsed.data;
    const db = await getDb();

    const stages = await getStages();
    const stage = stages.find((s) => s.slug === d.stage) ?? stages[0]!;

    // Si el negocio se creo desde un contacto, se hereda la empresa.
    let companyId = d.companyId ?? null;
    if (!companyId && d.contactId) {
      const [c] = await db.select({ companyId: contacts.companyId }).from(contacts).where(eq(contacts.id, d.contactId)).limit(1);
      companyId = c?.companyId ?? null;
    }

    const [row] = await db
      .insert(opportunities)
      .values({
        name: d.name.trim(),
        contactId: d.contactId ?? null,
        companyId,
        segment: d.segment,
        productId: d.productId ?? null,
        amount: toMoneyString(parseMoneyInput(d.amount ?? "0")),
        currency: d.currency,
        taxRate: await taxRateFor(d.requiresInvoice),
        requiresInvoice: d.requiresInvoice,
        stage: stage.slug,
        stageChangedAt: new Date(),
        probability: d.probability ?? stage.probability,
        expectedCloseOn: d.expectedCloseOn ?? null,
        responsibleId: d.responsibleId ?? me.id,
        sourceId: d.sourceId ?? null,
        campaignId: d.campaignId ?? null,
        billingStatus: d.requiresInvoice ? "pendiente" : "no-requiere",
        notes: d.notes ?? null,
        createdBy: me.id,
        updatedBy: me.id,
      })
      .returning({ id: opportunities.id });

    // El contacto pasa a tener negocio abierto.
    if (d.contactId) {
      await db
        .update(contacts)
        .set({ status: "oportunidad", updatedAt: new Date() })
        .where(and(eq(contacts.id, d.contactId), eq(contacts.status, "nuevo")));
    }

    if (d.nextActionTitle) {
      await db.insert(tasks).values({
        title: d.nextActionTitle,
        kind: "otro",
        dueAt: d.nextActionDate ? new Date(d.nextActionDate) : addDays(new Date(), 2),
        contactId: d.contactId ?? null,
        companyId,
        opportunityId: row!.id,
        responsibleId: d.responsibleId ?? me.id,
        createdBy: me.id,
      });
    }

    await logEvent({
      kind: "estado",
      title: `Negocio creado en ${stage.name}`,
      amount: d.amount,
      currency: d.currency,
      contactId: d.contactId ?? null,
      companyId,
      opportunityId: row!.id,
      userId: me.id,
      touch: false,
    });
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "crear",
      entityType: "negocio",
      entityId: row!.id,
      summary: `Creo el negocio ${d.name}`,
    });
    if (d.contactId) await recalcLeadScore(d.contactId);

    revalidatePath("/negocios");
    revalidatePath("/");
    return ok({ id: row!.id });
  } catch (err) {
    return fail(explain(err));
  }
}

export async function updateOpportunity(id: string, formData: FormData): Promise<Result> {
  try {
    const me = await requireUser();
    const parsed = oppSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
    const d = parsed.data;
    const db = await getDb();

    const [before] = await db.select().from(opportunities).where(eq(opportunities.id, id)).limit(1);
    if (!before) return fail("Ese negocio ya no existe");

    const stages = await getStages();
    const stage = stages.find((s) => s.slug === d.stage) ?? stages[0]!;
    const stageChanged = before.stage !== stage.slug;

    const patch: Record<string, unknown> = {
      name: d.name.trim(),
      contactId: d.contactId ?? null,
      companyId: d.companyId ?? null,
      segment: d.segment,
      productId: d.productId ?? null,
      amount: toMoneyString(parseMoneyInput(d.amount ?? "0")),
      currency: d.currency,
      taxRate: await taxRateFor(d.requiresInvoice),
      requiresInvoice: d.requiresInvoice,
      stage: stage.slug,
      probability: d.probability ?? (stageChanged ? stage.probability : before.probability),
      expectedCloseOn: d.expectedCloseOn ?? null,
      responsibleId: d.responsibleId ?? null,
      sourceId: d.sourceId ?? null,
      campaignId: d.campaignId ?? null,
      notes: d.notes ?? null,
      updatedBy: me.id,
      updatedAt: new Date(),
    };
    if (stageChanged) {
      patch.stageChangedAt = new Date();
      if (stage.kind === "ganado" || stage.kind === "perdido") patch.closedAt = new Date();
      else patch.closedAt = null;
    }
    if (d.requiresInvoice && before.billingStatus === "no-requiere") patch.billingStatus = "pendiente";
    if (!d.requiresInvoice && before.billingStatus === "pendiente") patch.billingStatus = "no-requiere";

    await db.update(opportunities).set(patch).where(eq(opportunities.id, id));

    const changes = diffRecords(before as unknown as Record<string, unknown>, patch, {
      name: "Nombre",
      amount: "Valor",
      stage: "Etapa",
      expectedCloseOn: "Cierre estimado",
      responsibleId: "Responsable",
      probability: "Probabilidad",
    });
    if (changes.length > 0) {
      await logAudit({
        userId: me.id,
        userName: me.name,
        action: "actualizar",
        entityType: "negocio",
        entityId: id,
        summary: `Actualizo ${changes.map((c) => c.field).join(", ")}`,
        changes,
      });
    }
    if (stageChanged) {
      await logEvent({
        kind: "estado",
        title: `Etapa cambiada a ${stage.name}`,
        contactId: d.contactId ?? null,
        companyId: d.companyId ?? null,
        opportunityId: id,
        userId: me.id,
        touch: false,
      });
    }

    await recalcOpportunityFinance(id);
    if (d.contactId) await recalcLeadScore(d.contactId);
    revalidatePath("/negocios");
    revalidatePath(`/negocios/${id}`);
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

/** Mover una tarjeta del tablero. Solo cambia la etapa. */
export async function moveStage(id: string, stageSlug: string): Promise<Result> {
  try {
    const me = await requireUser();
    const db = await getDb();
    const stages = await getStages();
    const stage = stages.find((s) => s.slug === stageSlug);
    if (!stage) return fail("Esa etapa no existe");

    const [before] = await db.select().from(opportunities).where(eq(opportunities.id, id)).limit(1);
    if (!before) return fail("Ese negocio ya no existe");
    if (before.stage === stageSlug) return ok();

    // Marcar perdido pide un motivo: se hace desde el detalle, no arrastrando.
    if (stage.kind === "perdido" && !before.lostReason) {
      return fail("Para marcar un negocio como perdido, abre el negocio y registra el motivo.");
    }

    await db
      .update(opportunities)
      .set({
        stage: stageSlug,
        stageChangedAt: new Date(),
        probability: stage.probability,
        closedAt: stage.kind === "ganado" || stage.kind === "perdido" ? new Date() : null,
        updatedBy: me.id,
        updatedAt: new Date(),
      })
      .where(eq(opportunities.id, id));

    await logEvent({
      kind: "estado",
      title: `Etapa cambiada a ${stage.name}`,
      contactId: before.contactId,
      companyId: before.companyId,
      opportunityId: id,
      userId: me.id,
      touch: false,
    });
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: stage.kind === "ganado" ? "ganar" : "actualizar",
      entityType: "negocio",
      entityId: id,
      summary: `Movio ${before.name} a ${stage.name}`,
      changes: [{ field: "Etapa", from: before.stage, to: stageSlug }],
    });

    if (stage.kind === "ganado" && before.requiresInvoice) {
      await ensureTask({
        autoKey: `factura:${id}`,
        title: `Emitir factura de ${before.name}`,
        kind: "emitir-factura",
        dueAt: addDays(new Date(), 1),
        responsibleId: before.responsibleId,
        contactId: before.contactId,
        companyId: before.companyId,
        opportunityId: id,
        isDemo: before.isDemo,
      });
    }

    revalidatePath("/negocios");
    revalidatePath("/");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function markLost(id: string, reason: string, notes?: string): Promise<Result> {
  try {
    const me = await requireUser();
    if (!reason.trim()) return fail("Escribe el motivo de la pérdida");
    const db = await getDb();
    const stages = await getStages();
    const lost = stages.find((s) => s.kind === "perdido");
    if (!lost) return fail("No hay una etapa de perdido configurada");

    const [before] = await db.select().from(opportunities).where(eq(opportunities.id, id)).limit(1);
    if (!before) return fail("Ese negocio ya no existe");

    await db
      .update(opportunities)
      .set({
        stage: lost.slug,
        stageChangedAt: new Date(),
        probability: 0,
        lostReason: reason,
        closedAt: new Date(),
        notes: notes ? [before.notes, notes].filter(Boolean).join("\n\n") : before.notes,
        updatedBy: me.id,
        updatedAt: new Date(),
      })
      .where(eq(opportunities.id, id));

    // Ya no hay nada que perseguir: los pendientes abiertos se cierran.
    await db
      .update(tasks)
      .set({ status: "cancelada", updatedAt: new Date() })
      .where(and(eq(tasks.opportunityId, id), eq(tasks.status, "abierta")));

    await logEvent({
      kind: "estado",
      title: `Negocio perdido: ${reason}`,
      body: notes ?? null,
      contactId: before.contactId,
      companyId: before.companyId,
      opportunityId: id,
      userId: me.id,
      touch: false,
    });
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "perder",
      entityType: "negocio",
      entityId: id,
      summary: `Marco ${before.name} como perdido: ${reason}`,
    });

    revalidatePath("/negocios");
    revalidatePath(`/negocios/${id}`);
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function setDeliveryStatus(
  id: string,
  status: (typeof DELIVERY_STATUSES)[number],
): Promise<Result> {
  try {
    const me = await requireUser();
    const db = await getDb();
    await db
      .update(opportunities)
      .set({ deliveryStatus: status, updatedBy: me.id, updatedAt: new Date() })
      .where(eq(opportunities.id, id));
    revalidatePath(`/negocios/${id}`);
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function archiveOpportunity(id: string): Promise<Result> {
  try {
    const me = await requireUser();
    const db = await getDb();
    const [row] = await db.select({ name: opportunities.name }).from(opportunities).where(eq(opportunities.id, id)).limit(1);
    await db.update(opportunities).set({ deletedAt: new Date(), updatedBy: me.id }).where(eq(opportunities.id, id));
    await db
      .update(tasks)
      .set({ status: "cancelada", updatedAt: new Date() })
      .where(and(eq(tasks.opportunityId, id), eq(tasks.status, "abierta")));
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "archivar",
      entityType: "negocio",
      entityId: id,
      summary: `Archivo el negocio ${row?.name ?? id}`,
    });
    revalidatePath("/negocios");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

/** Sugiere el valor cuando se elige un producto del catalogo. */
export async function productPrice(productId: string) {
  const db = await getDb();
  const [row] = await db
    .select({
      price: products.defaultPrice,
      promo: products.promoPrice,
      currency: products.currency,
      name: products.name,
      taxable: products.taxable,
    })
    .from(products)
    .where(and(eq(products.id, productId), isNull(products.deletedAt)))
    .limit(1);
  return row ?? null;
}
