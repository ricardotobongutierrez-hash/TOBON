"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { contacts, opportunities, tasks } from "@/db/schema";
import { TASK_KINDS, TASK_KIND_LABEL, WAITING_FOR } from "@/db/enums";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { logEvent } from "@/lib/events";
import { recalcLeadScore } from "@/lib/automation";
import { addDays, toDate } from "@/lib/dates";
import { explain, fail, ok, type Result } from "./_result";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const taskSchema = z.object({
  title: z.string().trim().min(2, "Escribe que hay que hacer"),
  kind: z.enum(TASK_KINDS).default("otro"),
  dueAt: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  contactId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  companyId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  opportunityId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  responsibleId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  waitingFor: z.enum(WAITING_FOR).default("ninguno"),
  notes: z.preprocess(emptyToNull, z.string().nullable()).optional(),
});

export async function createTask(formData: FormData): Promise<Result<{ id: string }>> {
  try {
    const me = await requireUser();
    const parsed = taskSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
    const d = parsed.data;
    const db = await getDb();

    // Si viene de un negocio y no se dijo la empresa, se hereda.
    let companyId = d.companyId ?? null;
    let contactId = d.contactId ?? null;
    if (d.opportunityId && (!companyId || !contactId)) {
      const [opp] = await db
        .select({ companyId: opportunities.companyId, contactId: opportunities.contactId })
        .from(opportunities)
        .where(eq(opportunities.id, d.opportunityId))
        .limit(1);
      companyId ??= opp?.companyId ?? null;
      contactId ??= opp?.contactId ?? null;
    }

    const [row] = await db
      .insert(tasks)
      .values({
        title: d.title,
        kind: d.kind,
        dueAt: d.dueAt ? new Date(d.dueAt) : addDays(new Date(), 1),
        contactId,
        companyId,
        opportunityId: d.opportunityId ?? null,
        responsibleId: d.responsibleId ?? me.id,
        waitingFor: d.waitingFor,
        notes: d.notes ?? null,
        createdBy: me.id,
      })
      .returning({ id: tasks.id });

    revalidatePath("/pendientes");
    revalidatePath("/");
    return ok({ id: row!.id });
  } catch (err) {
    return fail(explain(err));
  }
}

const completeSchema = z.object({
  outcome: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  /** Que sigue. "ninguno" cierra el ciclo sin dejar pendiente. */
  next: z.string().default("ninguno"),
  nextTitle: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  nextDate: z.preprocess(emptyToNull, z.string().nullable()).optional(),
});

/**
 * Cerrar un seguimiento y, en el mismo paso, decidir que sigue.
 * Es el flujo mas usado del CRM: tiene que ser de dos clics.
 */
export async function completeTask(id: string, formData: FormData): Promise<Result> {
  try {
    const me = await requireUser();
    const parsed = completeSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
    const d = parsed.data;
    const db = await getDb();

    const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    if (!task) return fail("Ese pendiente ya no existe");
    if (task.status !== "abierta") return fail("Ese pendiente ya estaba cerrado");

    await db
      .update(tasks)
      .set({
        status: "hecha",
        completedAt: new Date(),
        completedBy: me.id,
        notes: d.outcome ? [task.notes, d.outcome].filter(Boolean).join("\n\n") : task.notes,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, id));

    await logEvent({
      kind: "tarea",
      direction: "salida",
      title: task.title,
      body: d.outcome ?? null,
      contactId: task.contactId,
      companyId: task.companyId,
      opportunityId: task.opportunityId,
      userId: me.id,
      isDemo: task.isDemo,
      // Cerrar un seguimiento cuenta como contacto con el cliente.
      touch: true,
    });

    if (d.next !== "ninguno") {
      const kind = TASK_KINDS.includes(d.next as never) ? (d.next as (typeof TASK_KINDS)[number]) : "otro";
      const waiting =
        kind === "esperar-respuesta"
          ? "cliente"
          : kind === "seguimiento-pago"
            ? "pago"
            : kind === "enviar-propuesta"
              ? "propuesta"
              : "ninguno";
      await db.insert(tasks).values({
        title: d.nextTitle?.trim() || TASK_KIND_LABEL[kind],
        kind,
        dueAt: d.nextDate ? toDate(d.nextDate)! : addDays(new Date(), 2),
        contactId: task.contactId,
        companyId: task.companyId,
        opportunityId: task.opportunityId,
        responsibleId: task.responsibleId ?? me.id,
        waitingFor: waiting,
        createdBy: me.id,
        isDemo: task.isDemo,
      });
    }

    if (task.contactId) await recalcLeadScore(task.contactId);
    revalidatePath("/pendientes");
    revalidatePath("/");
    if (task.opportunityId) revalidatePath(`/negocios/${task.opportunityId}`);
    if (task.contactId) revalidatePath(`/contactos/${task.contactId}`);
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function rescheduleTask(id: string, dueAt: string): Promise<Result> {
  try {
    await requireUser();
    const db = await getDb();
    await db
      .update(tasks)
      .set({ dueAt: new Date(dueAt), updatedAt: new Date() })
      .where(eq(tasks.id, id));
    revalidatePath("/pendientes");
    revalidatePath("/");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function cancelTask(id: string): Promise<Result> {
  try {
    const me = await requireUser();
    const db = await getDb();
    await db
      .update(tasks)
      .set({ status: "cancelada", completedBy: me.id, updatedAt: new Date() })
      .where(eq(tasks.id, id));
    revalidatePath("/pendientes");
    revalidatePath("/");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function reopenTask(id: string): Promise<Result> {
  try {
    await requireUser();
    const db = await getDb();
    await db
      .update(tasks)
      .set({ status: "abierta", completedAt: null, completedBy: null, updatedAt: new Date() })
      .where(eq(tasks.id, id));
    revalidatePath("/pendientes");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function reassignTask(id: string, responsibleId: string): Promise<Result> {
  try {
    const me = await requireUser();
    const db = await getDb();
    await db.update(tasks).set({ responsibleId, updatedAt: new Date() }).where(eq(tasks.id, id));
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "actualizar",
      entityType: "pendiente",
      entityId: id,
      summary: "Cambio el responsable del pendiente",
    });
    revalidatePath("/pendientes");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

// ───────────── Registro rapido de interaccion ─────────────

const interactionSchema = z.object({
  kind: z.enum(["whatsapp", "email", "llamada", "reunion", "nota"]),
  direction: z.enum(["entrada", "salida", "interno"]).default("salida"),
  title: z.string().trim().min(2, "Escribe un título corto"),
  body: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  occurredAt: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  contactId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  companyId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  opportunityId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  nextTitle: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  nextDate: z.preprocess(emptyToNull, z.string().nullable()).optional(),
});

/** Registrar una llamada, reunion, nota o mensaje, y de paso dejar el siguiente paso. */
export async function logInteraction(formData: FormData): Promise<Result> {
  try {
    const me = await requireUser();
    const parsed = interactionSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
    const d = parsed.data;
    const db = await getDb();

    let companyId = d.companyId ?? null;
    if (!companyId && d.contactId) {
      const [c] = await db.select({ companyId: contacts.companyId }).from(contacts).where(eq(contacts.id, d.contactId)).limit(1);
      companyId = c?.companyId ?? null;
    }

    await logEvent({
      kind: d.kind,
      direction: d.direction,
      title: d.title,
      body: d.body ?? null,
      occurredAt: d.occurredAt ? new Date(d.occurredAt) : new Date(),
      contactId: d.contactId ?? null,
      companyId,
      opportunityId: d.opportunityId ?? null,
      userId: me.id,
      touch: d.kind !== "nota",
    });

    if (d.nextTitle) {
      await db.insert(tasks).values({
        title: d.nextTitle,
        kind: "otro",
        dueAt: d.nextDate ? toDate(d.nextDate)! : addDays(new Date(), 2),
        contactId: d.contactId ?? null,
        companyId,
        opportunityId: d.opportunityId ?? null,
        responsibleId: me.id,
        createdBy: me.id,
      });
    }

    if (d.contactId) await recalcLeadScore(d.contactId);
    revalidatePath("/");
    revalidatePath("/pendientes");
    if (d.contactId) revalidatePath(`/contactos/${d.contactId}`);
    if (companyId) revalidatePath(`/empresas/${companyId}`);
    if (d.opportunityId) revalidatePath(`/negocios/${d.opportunityId}`);
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}
