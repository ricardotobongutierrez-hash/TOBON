"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import { companies, contacts, opportunities, tasks } from "@/db/schema";
import { PURCHASING_CAPACITY } from "@/db/enums";
import { requireUser } from "@/lib/auth";
import { diffRecords, logAudit } from "@/lib/audit";
import { logEvent } from "@/lib/events";
import { companyKey, domainFromWebsite, normalizeCountry, normalizeName, normalizeWebsite } from "@/lib/normalize";
import { explain, fail, ok, type Result } from "./_result";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);

const companySchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre de la empresa"),
  website: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  industry: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  country: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  city: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  size: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  responsibleId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  sourceId: z.preprocess(emptyToNull, z.string().nullable()).optional(),
  purchasingCapacity: z.enum(PURCHASING_CAPACITY).default("sin-definir"),
  notes: z.preprocess(emptyToNull, z.string().nullable()).optional(),
});

export async function findCompanyDuplicates(name: string, website?: string | null, excludeId?: string) {
  const db = await getDb();
  const key = companyKey(name);
  const domain = domainFromWebsite(website);
  const all = await db
    .select({ id: companies.id, name: companies.name, domain: companies.domain })
    .from(companies)
    .where(isNull(companies.deletedAt));
  return all.filter(
    (c) => c.id !== excludeId && (companyKey(c.name) === key || (domain !== null && c.domain === domain)),
  );
}

export async function createCompany(formData: FormData): Promise<Result<{ id: string }>> {
  try {
    const me = await requireUser();
    const parsed = companySchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
    const d = parsed.data;

    if (formData.get("forzarDuplicado") !== "si") {
      const dupes = await findCompanyDuplicates(d.name, d.website);
      if (dupes.length > 0) {
        return fail(`Ya existe "${dupes[0]!.name}". Revisa antes de crear un duplicado.`, "duplicado");
      }
    }

    const db = await getDb();
    const website = normalizeWebsite(d.website);
    const [row] = await db
      .insert(companies)
      .values({
        name: normalizeName(d.name),
        website,
        domain: domainFromWebsite(website),
        industry: d.industry ?? null,
        country: normalizeCountry(d.country),
        city: d.city ?? null,
        size: d.size ?? null,
        responsibleId: d.responsibleId ?? me.id,
        sourceId: d.sourceId ?? null,
        purchasingCapacity: d.purchasingCapacity,
        notes: d.notes ?? null,
        createdBy: me.id,
        updatedBy: me.id,
      })
      .returning({ id: companies.id });

    await logEvent({
      kind: "estado",
      title: "Empresa creada",
      companyId: row!.id,
      userId: me.id,
      touch: false,
    });
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "crear",
      entityType: "empresa",
      entityId: row!.id,
      summary: `Creo la empresa ${d.name}`,
    });

    revalidatePath("/empresas");
    return ok({ id: row!.id });
  } catch (err) {
    return fail(explain(err));
  }
}

export async function updateCompany(id: string, formData: FormData): Promise<Result> {
  try {
    const me = await requireUser();
    const parsed = companySchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Revisa los datos");
    const d = parsed.data;
    const db = await getDb();

    const [before] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
    if (!before) return fail("Esa empresa ya no existe");

    const website = normalizeWebsite(d.website);
    const patch = {
      name: normalizeName(d.name),
      website,
      domain: domainFromWebsite(website),
      industry: d.industry ?? null,
      country: normalizeCountry(d.country),
      city: d.city ?? null,
      size: d.size ?? null,
      responsibleId: d.responsibleId ?? null,
      sourceId: d.sourceId ?? null,
      purchasingCapacity: d.purchasingCapacity,
      notes: d.notes ?? null,
      updatedBy: me.id,
      updatedAt: new Date(),
    };
    await db.update(companies).set(patch).where(eq(companies.id, id));

    const changes = diffRecords(before as unknown as Record<string, unknown>, patch, {
      name: "Nombre",
      website: "Sitio web",
      industry: "Sector",
      purchasingCapacity: "Capacidad de compra",
      responsibleId: "Responsable",
    });
    if (changes.length > 0) {
      await logAudit({
        userId: me.id,
        userName: me.name,
        action: "actualizar",
        entityType: "empresa",
        entityId: id,
        summary: `Actualizo ${changes.map((c) => c.field).join(", ")}`,
        changes,
      });
    }

    revalidatePath("/empresas");
    revalidatePath(`/empresas/${id}`);
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function archiveCompany(id: string): Promise<Result> {
  try {
    const me = await requireUser();
    const db = await getDb();
    const [row] = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, id)).limit(1);
    await db.update(companies).set({ deletedAt: new Date(), updatedBy: me.id }).where(eq(companies.id, id));
    await db
      .update(tasks)
      .set({ status: "cancelada", updatedAt: new Date() })
      .where(and(eq(tasks.companyId, id), eq(tasks.status, "abierta")));
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "archivar",
      entityType: "empresa",
      entityId: id,
      summary: `Archivo la empresa ${row?.name ?? id}`,
    });
    revalidatePath("/empresas");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

/** Liga un contacto existente a la empresa. */
export async function attachContact(companyId: string, contactId: string): Promise<Result> {
  try {
    const me = await requireUser();
    const db = await getDb();
    await db
      .update(contacts)
      .set({ companyId, segment: "b2b", updatedBy: me.id, updatedAt: new Date() })
      .where(eq(contacts.id, contactId));
    const { companyContacts } = await import("@/db/schema");
    await db.insert(companyContacts).values({ companyId, contactId }).onConflictDoNothing();
    revalidatePath(`/empresas/${companyId}`);
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function mergeCompanies(keepId: string, mergeId: string): Promise<Result> {
  try {
    const me = await requireUser();
    if (keepId === mergeId) return fail("Son la misma empresa");
    const db = await getDb();
    const { interactions, proposals, invoices, payments, serviceDeliveries } = await import("@/db/schema");

    const [keep] = await db.select().from(companies).where(eq(companies.id, keepId)).limit(1);
    const [merge] = await db.select().from(companies).where(eq(companies.id, mergeId)).limit(1);
    if (!keep || !merge) return fail("Una de las empresas ya no existe");

    for (const table of [
      contacts,
      opportunities,
      tasks,
      interactions,
      proposals,
      invoices,
      payments,
      serviceDeliveries,
    ]) {
      await db.update(table).set({ companyId: keepId }).where(eq(table.companyId, mergeId));
    }

    await db
      .update(companies)
      .set({
        website: keep.website ?? merge.website,
        domain: keep.domain ?? merge.domain,
        industry: keep.industry ?? merge.industry,
        country: keep.country ?? merge.country,
        city: keep.city ?? merge.city,
        size: keep.size ?? merge.size,
        notes: [keep.notes, merge.notes].filter(Boolean).join("\n\n") || null,
        updatedBy: me.id,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, keepId));

    await db.update(companies).set({ deletedAt: new Date() }).where(eq(companies.id, mergeId));

    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "fusionar",
      entityType: "empresa",
      entityId: keepId,
      summary: `Fusiono ${merge.name} dentro de ${keep.name}`,
    });
    revalidatePath("/empresas");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}
