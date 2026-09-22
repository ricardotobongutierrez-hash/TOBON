"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { companies, contacts, contactTags, opportunities, tags, tasks } from "@/db/schema";
import { CONTACT_STATUSES, SEGMENTS } from "@/db/enums";
import { requireUser } from "@/lib/auth";
import { logAudit, diffRecords } from "@/lib/audit";
import { logEvent } from "@/lib/events";
import { recalcLeadScore } from "@/lib/automation";
import {
  companyKey,
  corporateDomain,
  normalizeCountry,
  normalizeEmail,
  normalizeName,
  normalizePhone,
} from "@/lib/normalize";
import { fail, explain, ok, type Result } from "./_result";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const contactSchema = z.object({
  fullName: z.string().trim().min(2, "Escribe el nombre del contacto"),
  phone: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  email: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  companyId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  newCompanyName: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  position: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  city: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  country: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  segment: z.enum(SEGMENTS).default("b2c"),
  sourceId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  campaignId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  interestProductId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  responsibleId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  status: z.enum(CONTACT_STATUSES).default("nuevo"),
  notes: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  tags: z.preprocess(emptyToNull, z.string().nullable()).optional(),
});

function read(formData: FormData) {
  return contactSchema.safeParse(Object.fromEntries(formData));
}

/** Duplicados por correo, por telefono normalizado o por nombre dentro de la misma empresa. */
export async function findDuplicates(input: {
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  companyId?: string | null;
  excludeId?: string;
}) {
  const db = await getDb();
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const name = normalizeName(input.fullName ?? "").toLowerCase();

  const clauses = [];
  if (email) clauses.push(eq(contacts.emailNormalized, email));
  if (phone) clauses.push(eq(contacts.phoneNormalized, phone));
  if (name && input.companyId) {
    clauses.push(and(sql`lower(${contacts.fullName}) = ${name}`, eq(contacts.companyId, input.companyId))!);
  }
  if (clauses.length === 0) return [];

  const rows = await db
    .select({
      id: contacts.id,
      fullName: contacts.fullName,
      email: contacts.email,
      phone: contacts.phone,
      companyName: companies.name,
    })
    .from(contacts)
    .leftJoin(companies, eq(contacts.companyId, companies.id))
    .where(and(isNull(contacts.deletedAt), or(...clauses)))
    .limit(5);

  return input.excludeId ? rows.filter((r) => r.id !== input.excludeId) : rows;
}

async function resolveTags(names: string | null | undefined): Promise<string[]> {
  if (!names) return [];
  const db = await getDb();
  const wanted = names
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12);
  const ids: string[] = [];
  for (const name of wanted) {
    const [existing] = await db.select({ id: tags.id }).from(tags).where(eq(tags.name, name)).limit(1);
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const [created] = await db.insert(tags).values({ name }).onConflictDoNothing().returning({ id: tags.id });
    if (created) ids.push(created.id);
  }
  return ids;
}

export async function createContact(formData: FormData): Promise<Result<{ id: string }>> {
  try {
    const me = await requireUser();
    const parsed = read(formData);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
    const d = parsed.data;
    const db = await getDb();

    const email = normalizeEmail(d.email);
    const phone = normalizePhone(d.phone);
    if (d.email && !email) return fail("Ese correo no parece valido", "email");

    // Si no se eligio empresa pero se escribio un nombre nuevo, se crea o se reusa.
    let companyId = d.companyId ?? null;
    if (!companyId && d.newCompanyName) {
      companyId = await upsertCompanyByName(d.newCompanyName, me.id, email);
    }

    const force = formData.get("forzarDuplicado") === "si";
    if (!force) {
      const dupes = await findDuplicates({ email, phone, fullName: d.fullName, companyId });
      if (dupes.length > 0) {
        return fail(
          `Ya existe ${dupes[0]!.fullName}${dupes[0]!.companyName ? ` de ${dupes[0]!.companyName}` : ""} con ese dato. Revisa antes de crear un duplicado.`,
          "duplicado",
        );
      }
    }

    const [row] = await db
      .insert(contacts)
      .values({
        fullName: normalizeName(d.fullName),
        phone: d.phone ?? null,
        phoneNormalized: phone,
        email: email,
        emailNormalized: email,
        companyId,
        position: d.position ?? null,
        city: d.city ?? null,
        country: normalizeCountry(d.country),
        segment: d.segment,
        sourceId: d.sourceId ?? null,
        campaignId: d.campaignId ?? null,
        firstTouchSourceId: d.sourceId ?? null,
        lastTouchSourceId: d.sourceId ?? null,
        interestProductId: d.interestProductId ?? null,
        responsibleId: d.responsibleId ?? me.id,
        status: d.status,
        notes: d.notes ?? null,
        createdBy: me.id,
        updatedBy: me.id,
      })
      .returning({ id: contacts.id });

    const tagIds = await resolveTags(d.tags);
    if (tagIds.length > 0) {
      await db
        .insert(contactTags)
        .values(tagIds.map((tagId) => ({ contactId: row!.id, tagId })))
        .onConflictDoNothing();
    }

    await logEvent({
      kind: "estado",
      title: "Contacto creado",
      contactId: row!.id,
      companyId,
      userId: me.id,
      touch: false,
    });
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "crear",
      entityType: "contacto",
      entityId: row!.id,
      summary: `Creo el contacto ${d.fullName}`,
    });
    await recalcLeadScore(row!.id);

    revalidatePath("/contactos");
    revalidatePath("/");
    return ok({ id: row!.id });
  } catch (err) {
    return fail(explain(err));
  }
}

export async function updateContact(id: string, formData: FormData): Promise<Result> {
  try {
    const me = await requireUser();
    const parsed = read(formData);
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
    const d = parsed.data;
    const db = await getDb();

    const [before] = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
    if (!before) return fail("Ese contacto ya no existe");

    const email = normalizeEmail(d.email);
    if (d.email && !email) return fail("Ese correo no parece valido", "email");

    let companyId = d.companyId ?? null;
    if (!companyId && d.newCompanyName) {
      companyId = await upsertCompanyByName(d.newCompanyName, me.id, email);
    }

    const patch = {
      fullName: normalizeName(d.fullName),
      phone: d.phone ?? null,
      phoneNormalized: normalizePhone(d.phone),
      email,
      emailNormalized: email,
      companyId,
      position: d.position ?? null,
      city: d.city ?? null,
      country: normalizeCountry(d.country),
      segment: d.segment,
      sourceId: d.sourceId ?? null,
      campaignId: d.campaignId ?? null,
      lastTouchSourceId: d.sourceId ?? before.lastTouchSourceId,
      interestProductId: d.interestProductId ?? null,
      responsibleId: d.responsibleId ?? null,
      status: d.status,
      notes: d.notes ?? null,
      updatedBy: me.id,
      updatedAt: new Date(),
    };

    await db.update(contacts).set(patch).where(eq(contacts.id, id));

    const tagIds = await resolveTags(d.tags);
    await db.delete(contactTags).where(eq(contactTags.contactId, id));
    if (tagIds.length > 0) {
      await db
        .insert(contactTags)
        .values(tagIds.map((tagId) => ({ contactId: id, tagId })))
        .onConflictDoNothing();
    }

    const changes = diffRecords(before as unknown as Record<string, unknown>, patch, {
      fullName: "Nombre",
      email: "Correo",
      phone: "Teléfono",
      status: "Estado",
      segment: "Tipo",
      responsibleId: "Responsable",
      companyId: "Empresa",
    });
    if (changes.length > 0) {
      await logAudit({
        userId: me.id,
        userName: me.name,
        action: "actualizar",
        entityType: "contacto",
        entityId: id,
        summary: `Actualizo ${changes.map((c) => c.field).join(", ")}`,
        changes,
      });
    }
    if (before.status !== d.status) {
      await logEvent({
        kind: "estado",
        title: `Estado cambiado a ${d.status}`,
        contactId: id,
        companyId,
        userId: me.id,
        touch: false,
      });
    }

    await recalcLeadScore(id);
    revalidatePath("/contactos");
    revalidatePath(`/contactos/${id}`);
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

/** Borrado suave: el contacto sale de las listas pero el historial no se pierde. */
export async function archiveContact(id: string): Promise<Result> {
  try {
    const me = await requireUser();
    const db = await getDb();
    const [row] = await db.select({ name: contacts.fullName }).from(contacts).where(eq(contacts.id, id)).limit(1);
    await db.update(contacts).set({ deletedAt: new Date(), updatedBy: me.id }).where(eq(contacts.id, id));
    await db
      .update(tasks)
      .set({ status: "cancelada", updatedAt: new Date() })
      .where(and(eq(tasks.contactId, id), eq(tasks.status, "abierta")));
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "archivar",
      entityType: "contacto",
      entityId: id,
      summary: `Archivo el contacto ${row?.name ?? id}`,
    });
    revalidatePath("/contactos");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function restoreContact(id: string): Promise<Result> {
  try {
    const me = await requireUser();
    const db = await getDb();
    await db.update(contacts).set({ deletedAt: null, updatedBy: me.id }).where(eq(contacts.id, id));
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "restaurar",
      entityType: "contacto",
      entityId: id,
      summary: "Restauró el contacto",
    });
    revalidatePath("/contactos");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

/** Fija el puntaje a mano. Con null vuelve al calculo automatico. */
export async function setLeadScore(id: string, value: number | null): Promise<Result> {
  try {
    const me = await requireUser();
    const db = await getDb();
    await db
      .update(contacts)
      .set({ leadScoreManual: value, updatedBy: me.id, updatedAt: new Date() })
      .where(eq(contacts.id, id));
    await recalcLeadScore(id);
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "actualizar",
      entityType: "contacto",
      entityId: id,
      summary: value === null ? "Devolvio el puntaje al calculo automático" : `Fijo el puntaje en ${value}`,
    });
    revalidatePath(`/contactos/${id}`);
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

/** Fusiona dos contactos: todo lo del origen se mueve al destino. */
export async function mergeContacts(keepId: string, mergeId: string): Promise<Result> {
  try {
    const me = await requireUser();
    if (keepId === mergeId) return fail("Son el mismo contacto");
    const db = await getDb();
    const { interactions, proposals, invoices, payments } = await import("@/db/schema");

    const [keep] = await db.select().from(contacts).where(eq(contacts.id, keepId)).limit(1);
    const [merge] = await db.select().from(contacts).where(eq(contacts.id, mergeId)).limit(1);
    if (!keep || !merge) return fail("Uno de los contactos ya no existe");

    for (const table of [interactions, opportunities, tasks, proposals, invoices, payments]) {
      await db.update(table).set({ contactId: keepId }).where(eq(table.contactId, mergeId));
    }

    // Los datos vacios del que se queda se rellenan con los del otro.
    await db
      .update(contacts)
      .set({
        email: keep.email ?? merge.email,
        emailNormalized: keep.emailNormalized ?? merge.emailNormalized,
        phone: keep.phone ?? merge.phone,
        phoneNormalized: keep.phoneNormalized ?? merge.phoneNormalized,
        companyId: keep.companyId ?? merge.companyId,
        position: keep.position ?? merge.position,
        city: keep.city ?? merge.city,
        country: keep.country ?? merge.country,
        notes: [keep.notes, merge.notes].filter(Boolean).join("\n\n") || null,
        updatedBy: me.id,
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, keepId));

    await db.update(contacts).set({ deletedAt: new Date() }).where(eq(contacts.id, mergeId));

    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "fusionar",
      entityType: "contacto",
      entityId: keepId,
      summary: `Fusiono ${merge.fullName} dentro de ${keep.fullName}`,
    });
    await recalcLeadScore(keepId);
    revalidatePath("/contactos");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

/** Busca una empresa por nombre normalizado o la crea. Evita "Dorex" y "DOREX SAS". */
export async function upsertCompanyByName(
  name: string,
  userId: string,
  contactEmail?: string | null,
): Promise<string> {
  const db = await getDb();
  const key = companyKey(name);
  const all = await db
    .select({ id: companies.id, name: companies.name, domain: companies.domain })
    .from(companies)
    .where(isNull(companies.deletedAt));
  const domain = corporateDomain(contactEmail);
  const match =
    all.find((c) => companyKey(c.name) === key) ?? (domain ? all.find((c) => c.domain === domain) : undefined);
  if (match) return match.id;

  const [created] = await db
    .insert(companies)
    .values({
      name: normalizeName(name),
      domain: domain ?? null,
      responsibleId: userId,
      createdBy: userId,
      updatedBy: userId,
    })
    .returning({ id: companies.id });
  return created!.id;
}
