"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { opportunities, proposals, proposalVersions, tasks } from "@/db/schema";
import { CURRENCIES, PROPOSAL_STATUSES, type ProposalStatus } from "@/db/enums";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { logEvent } from "@/lib/events";
import { onProposalAccepted, onProposalSent } from "@/lib/automation";
import { financeSettings } from "@/lib/settings";
import { parseMoneyInput, toMoneyString } from "@/lib/money";
import { explain, fail, ok, type Result } from "./_result";
import { uploadAttachment } from "./files";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const proposalSchema = z.object({
  title: z.string().trim().min(2, "Ponle un título a la propuesta"),
  opportunityId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  contactId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  companyId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  productId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  amount: z.string().default("0"),
  currency: z.enum(CURRENCIES).default("COP"),
  status: z.enum(PROPOSAL_STATUSES).default("borrador"),
  expiresOn: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  responsibleId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  notes: z.preprocess(emptyToNull, z.string().nullable()).optional(),
});

/** Numero consecutivo legible: P-2026-014. */
async function nextNumber(): Promise<string> {
  const db = await getDb();
  const cfg = await financeSettings();
  const year = new Date().getFullYear();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(proposals)
    .where(sql`${proposals.number} like ${`${cfg.proposalPrefix}-${year}-%`}`);
  return `${cfg.proposalPrefix}-${year}-${String((row?.n ?? 0) + 1).padStart(3, "0")}`;
}

export async function createProposal(formData: FormData): Promise<Result<{ id: string }>> {
  try {
    const me = await requireUser();
    const parsed = proposalSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
    const d = parsed.data;
    const db = await getDb();

    let { contactId, companyId } = d;
    if (d.opportunityId) {
      const [opp] = await db.select().from(opportunities).where(eq(opportunities.id, d.opportunityId)).limit(1);
      contactId ??= opp?.contactId ?? null;
      companyId ??= opp?.companyId ?? null;
    }

    const amount = toMoneyString(parseMoneyInput(d.amount));
    const number = await nextNumber();

    const [row] = await db
      .insert(proposals)
      .values({
        number,
        title: d.title,
        opportunityId: d.opportunityId ?? null,
        contactId: contactId ?? null,
        companyId: companyId ?? null,
        productId: d.productId ?? null,
        currentVersion: 1,
        amount,
        currency: d.currency,
        status: d.status,
        sentAt: d.status === "enviada" ? new Date() : null,
        expiresOn: d.expiresOn ?? null,
        responsibleId: d.responsibleId ?? me.id,
        notes: d.notes ?? null,
        createdBy: me.id,
      })
      .returning({ id: proposals.id });

    await db.insert(proposalVersions).values({
      proposalId: row!.id,
      version: 1,
      amount,
      currency: d.currency,
      status: d.status,
      sentAt: d.status === "enviada" ? new Date() : null,
      expiresOn: d.expiresOn ?? null,
      notes: d.notes ?? null,
      createdBy: me.id,
    });

    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      const fd = new FormData();
      fd.set("file", file);
      const up = await uploadAttachment("propuesta", row!.id, fd);
      if (up.ok) {
        await db
          .update(proposalVersions)
          .set({ attachmentId: up.data.id })
          .where(and(eq(proposalVersions.proposalId, row!.id), eq(proposalVersions.version, 1)));
      }
    }

    if (d.opportunityId) {
      await db
        .update(opportunities)
        .set({ proposalStatus: d.status, updatedAt: new Date() })
        .where(eq(opportunities.id, d.opportunityId));
    }

    await logEvent({
      kind: "propuesta",
      direction: d.status === "enviada" ? "salida" : "interno",
      title: d.status === "enviada" ? `Propuesta ${number} enviada` : `Propuesta ${number} creada`,
      amount,
      currency: d.currency,
      contactId: contactId ?? null,
      companyId: companyId ?? null,
      opportunityId: d.opportunityId ?? null,
      userId: me.id,
      touch: d.status === "enviada",
    });
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "crear",
      entityType: "propuesta",
      entityId: row!.id,
      summary: `Creo la propuesta ${number}`,
    });

    if (d.status === "enviada") await onProposalSent(row!.id);

    revalidatePath("/negocios");
    revalidatePath("/pendientes");
    return ok({ id: row!.id });
  } catch (err) {
    return fail(explain(err));
  }
}

/** Nueva version de una propuesta existente. La anterior queda en el historial. */
export async function addProposalVersion(proposalId: string, formData: FormData): Promise<Result> {
  try {
    const me = await requireUser();
    const db = await getDb();
    const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
    if (!proposal) return fail("Esa propuesta ya no existe");

    const amount = toMoneyString(parseMoneyInput(String(formData.get("amount") ?? "0")));
    const status = (formData.get("status") as ProposalStatus) ?? "borrador";
    const expiresOn = (formData.get("expiresOn") as string) || null;
    const notes = (formData.get("notes") as string) || null;
    const version = proposal.currentVersion + 1;

    const [created] = await db
      .insert(proposalVersions)
      .values({
        proposalId,
        version,
        amount,
        currency: proposal.currency,
        status,
        sentAt: status === "enviada" ? new Date() : null,
        expiresOn,
        notes,
        createdBy: me.id,
      })
      .returning({ id: proposalVersions.id });

    const file = formData.get("file");
    if (file instanceof File && file.size > 0) {
      const fd = new FormData();
      fd.set("file", file);
      const up = await uploadAttachment("propuesta", proposalId, fd);
      if (up.ok) {
        await db
          .update(proposalVersions)
          .set({ attachmentId: up.data.id })
          .where(eq(proposalVersions.id, created!.id));
      }
    }

    await db
      .update(proposals)
      .set({
        currentVersion: version,
        amount,
        status,
        sentAt: status === "enviada" ? new Date() : proposal.sentAt,
        expiresOn,
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, proposalId));

    if (proposal.opportunityId) {
      await db
        .update(opportunities)
        .set({ proposalStatus: status, updatedAt: new Date() })
        .where(eq(opportunities.id, proposal.opportunityId));
    }

    await logEvent({
      kind: "propuesta",
      direction: status === "enviada" ? "salida" : "interno",
      title: `Propuesta ${proposal.number} version ${version}${status === "enviada" ? " enviada" : ""}`,
      amount,
      currency: proposal.currency,
      contactId: proposal.contactId,
      companyId: proposal.companyId,
      opportunityId: proposal.opportunityId,
      userId: me.id,
      touch: status === "enviada",
    });
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "actualizar",
      entityType: "propuesta",
      entityId: proposalId,
      summary: `Agrego la version ${version} de ${proposal.number}`,
    });

    if (status === "enviada") await onProposalSent(proposalId);

    revalidatePath("/negocios");
    revalidatePath("/pendientes");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function setProposalStatus(proposalId: string, status: ProposalStatus): Promise<Result> {
  try {
    const me = await requireUser();
    const db = await getDb();
    const [proposal] = await db.select().from(proposals).where(eq(proposals.id, proposalId)).limit(1);
    if (!proposal) return fail("Esa propuesta ya no existe");

    const responded = ["aceptada", "rechazada", "cambios-solicitados"].includes(status);
    await db
      .update(proposals)
      .set({
        status,
        sentAt: status === "enviada" && !proposal.sentAt ? new Date() : proposal.sentAt,
        respondedAt: responded ? new Date() : proposal.respondedAt,
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, proposalId));

    await db
      .update(proposalVersions)
      .set({ status, sentAt: status === "enviada" ? new Date() : undefined })
      .where(
        and(eq(proposalVersions.proposalId, proposalId), eq(proposalVersions.version, proposal.currentVersion)),
      );

    if (proposal.opportunityId) {
      await db
        .update(opportunities)
        .set({ proposalStatus: status, updatedAt: new Date() })
        .where(eq(opportunities.id, proposal.opportunityId));
    }

    // Ya respondio: el pendiente de "esperar respuesta" pierde sentido.
    if (responded) {
      await db
        .update(tasks)
        .set({ status: "hecha", completedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(tasks.proposalId, proposalId), eq(tasks.status, "abierta")));
    }

    await logAudit({
      userId: me.id,
      userName: me.name,
      action: status === "aceptada" ? "aceptar" : status === "rechazada" ? "rechazar" : "actualizar",
      entityType: "propuesta",
      entityId: proposalId,
      summary: `Propuesta ${proposal.number}: ${status}`,
      changes: [{ field: "Estado", from: proposal.status, to: status }],
    });

    if (status === "aceptada") {
      await onProposalAccepted(proposalId, me.id);
    } else if (status === "enviada") {
      await logEvent({
        kind: "propuesta",
        direction: "salida",
        title: `Propuesta ${proposal.number} enviada`,
        amount: proposal.amount,
        currency: proposal.currency,
        contactId: proposal.contactId,
        companyId: proposal.companyId,
        opportunityId: proposal.opportunityId,
        userId: me.id,
      });
      await onProposalSent(proposalId);
    } else if (status === "rechazada") {
      await logEvent({
        kind: "propuesta",
        title: `Propuesta ${proposal.number} rechazada`,
        contactId: proposal.contactId,
        companyId: proposal.companyId,
        opportunityId: proposal.opportunityId,
        userId: me.id,
        touch: false,
      });
    }

    revalidatePath("/negocios");
    revalidatePath("/finanzas");
    revalidatePath("/pendientes");
    if (proposal.opportunityId) revalidatePath(`/negocios/${proposal.opportunityId}`);
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function archiveProposal(id: string): Promise<Result> {
  try {
    const me = await requireUser();
    const db = await getDb();
    const [row] = await db.select({ number: proposals.number }).from(proposals).where(eq(proposals.id, id)).limit(1);
    await db.update(proposals).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(proposals.id, id));
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "archivar",
      entityType: "propuesta",
      entityId: id,
      summary: `Archivo la propuesta ${row?.number ?? id}`,
    });
    revalidatePath("/negocios");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function proposalVersionsOf(proposalId: string) {
  const db = await getDb();
  return db
    .select()
    .from(proposalVersions)
    .where(eq(proposalVersions.proposalId, proposalId))
    .orderBy(desc(proposalVersions.version));
}

export async function proposalsFor(opportunityId: string) {
  const db = await getDb();
  return db
    .select()
    .from(proposals)
    .where(and(eq(proposals.opportunityId, opportunityId), isNull(proposals.deletedAt)))
    .orderBy(desc(proposals.createdAt));
}
