"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { opportunities, serviceDeliveries, tasks } from "@/db/schema";
import { DELIVERY_STATUSES, type DeliveryStatus } from "@/db/enums";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { logEvent } from "@/lib/events";
import { explain, fail, ok, type Result } from "./_result";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const deliverySchema = z.object({
  title: z.string().trim().min(2, "Escribe que servicio se va a entregar"),
  opportunityId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  productId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  companyId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  contactId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  status: z.enum(DELIVERY_STATUSES).default("por-programar"),
  scheduledAt: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  endsAt: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  location: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  isOnline: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()).default(false),
  responsibleId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  notes: z.preprocess(emptyToNull, z.string().nullable()).optional(),
});

export async function createDelivery(formData: FormData): Promise<Result<{ id: string }>> {
  try {
    const me = await requireUser();
    const parsed = deliverySchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
    const d = parsed.data;
    const db = await getDb();

    let { contactId, companyId, productId } = d;
    if (d.opportunityId) {
      const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, d.opportunityId)).limit(1);
      contactId ??= opp?.contactId ?? null;
      companyId ??= opp?.companyId ?? null;
      productId ??= opp?.productId ?? null;
    }

    const [row] = await db
      .insert(serviceDeliveries)
      .values({
        title: d.title,
        opportunityId: d.opportunityId ?? null,
        productId: productId ?? null,
        companyId: companyId ?? null,
        contactId: contactId ?? null,
        status: d.status,
        scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : null,
        endsAt: d.endsAt ? new Date(d.endsAt) : null,
        location: d.location ?? null,
        isOnline: d.isOnline,
        responsibleId: d.responsibleId ?? me.id,
        notes: d.notes ?? null,
        createdBy: me.id,
      })
      .returning({ id: serviceDeliveries.id });

    if (d.opportunityId) {
      await db
        .update(opportunities)
        .set({ deliveryStatus: d.status, updatedAt: new Date() })
        .where(eq(opportunities.id, d.opportunityId));
    }

    await logEvent({
      kind: "servicio",
      title: `Servicio ${d.status === "programado" ? "programado" : "registrado"}: ${d.title}`,
      body: d.scheduledAt ?? null,
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
      entityType: "servicio",
      entityId: row!.id,
      summary: `Registro la entrega del servicio ${d.title}`,
    });

    revalidatePath("/pendientes");
    if (d.opportunityId) revalidatePath(`/negocios/${d.opportunityId}`);
    return ok({ id: row!.id });
  } catch (err) {
    return fail(explain(err));
  }
}

export async function setDeliveryState(
  id: string,
  status: DeliveryStatus,
  scheduledAt?: string | null,
): Promise<Result> {
  try {
    const me = await requireUser();
    const db = await getDb();
    const [row] = await db.select().from(serviceDeliveries).where(eq(serviceDeliveries.id, id)).limit(1);
    if (!row) return fail("Ese servicio ya no existe");

    await db
      .update(serviceDeliveries)
      .set({
        status,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : row.scheduledAt,
        updatedAt: new Date(),
      })
      .where(eq(serviceDeliveries.id, id));

    if (row.opportunityId) {
      await db
        .update(opportunities)
        .set({ deliveryStatus: status, updatedAt: new Date() })
        .where(eq(opportunities.id, row.opportunityId));
      if (status === "completado" || status === "cancelado") {
        await db
          .update(tasks)
          .set({ status: "hecha", completedAt: new Date(), completedBy: me.id, updatedAt: new Date() })
          .where(and(eq(tasks.autoKey, `servicio:${row.opportunityId}`), eq(tasks.status, "abierta")));
      }
    }

    await logEvent({
      kind: "servicio",
      title: `Servicio ${status}: ${row.title}`,
      contactId: row.contactId,
      companyId: row.companyId,
      opportunityId: row.opportunityId,
      userId: me.id,
      touch: false,
    });
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "actualizar",
      entityType: "servicio",
      entityId: id,
      summary: `Servicio ${row.title}: ${status}`,
      changes: [{ field: "Estado", from: row.status, to: status }],
    });

    revalidatePath("/pendientes");
    if (row.opportunityId) revalidatePath(`/negocios/${row.opportunityId}`);
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function deliveriesOf(opportunityId: string) {
  const db = await getDb();
  return db
    .select()
    .from(serviceDeliveries)
    .where(and(eq(serviceDeliveries.opportunityId, opportunityId), isNull(serviceDeliveries.deletedAt)))
    .orderBy(asc(serviceDeliveries.scheduledAt));
}
