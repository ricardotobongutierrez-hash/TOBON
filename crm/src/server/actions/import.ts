"use server";

import { and, eq, isNull, or, sql } from "drizzle-orm";
import Papa from "papaparse";
import { getDb } from "@/db/client";
import { campaigns, companies, contacts, importBatches, leadSources, products, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { recalcLeadScore } from "@/lib/automation";
import {
  companyKey,
  corporateDomain,
  domainFromWebsite,
  normalizeCountry,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeSegment,
  normalizeWebsite,
} from "@/lib/normalize";
import { foldCase } from "@/lib/utils";
import { guessField, type ImportField } from "@/lib/import-fields";
import { explain, fail, ok, type Result } from "./_result";

/**
 * Importacion guiada de contactos y empresas.
 *
 * Tres pasos del lado del servidor: leer el archivo y detectar columnas, mostrar
 * una vista previa con los duplicados marcados, y solo entonces importar. Nunca
 * se sobreescribe un dato existente con uno vacio.
 */

export type ParsedFile = {
  headers: string[];
  rows: string[][];
  mapping: ImportField[];
  totalRows: number;
};

const MAX_ROWS = 5000;

/** Paso 1 y 2: leer el archivo, detectar encabezados y proponer el mapeo. */
export async function parseImportFile(formData: FormData): Promise<Result<ParsedFile>> {
  try {
    await requireUser();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return fail("Elige un archivo");
    if (file.size > 10 * 1024 * 1024) return fail("El archivo pesa más de 10 MB");

    const name = file.name.toLowerCase();
    let headers: string[] = [];
    let rows: string[][] = [];

    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await file.arrayBuffer());
      const sheet = workbook.worksheets[0];
      if (!sheet) return fail("El archivo de Excel no tiene ninguna hoja");
      const all: string[][] = [];
      sheet.eachRow((row) => {
        const values: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          const v = cell.value;
          if (v === null || v === undefined) values.push("");
          else if (typeof v === "object" && "text" in v) values.push(String(v.text));
          else if (v instanceof Date) values.push(v.toISOString().slice(0, 10));
          else values.push(String(v));
        });
        all.push(values);
      });
      headers = (all.shift() ?? []).map((h) => h.trim());
      rows = all;
    } else if (name.endsWith(".csv") || name.endsWith(".txt")) {
      const text = new TextDecoder("utf-8").decode(await file.arrayBuffer());
      const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ""), {
        skipEmptyLines: "greedy",
        // Papa detecta si el archivo usa coma, punto y coma o tabulacion.
        delimiter: "",
      });
      const data = parsed.data.filter((r) => Array.isArray(r) && r.some((c) => String(c).trim() !== ""));
      headers = (data.shift() ?? []).map((h) => String(h).trim());
      rows = data.map((r) => r.map((c) => String(c ?? "")));
    } else {
      return fail("Formato no soportado. Usa CSV o Excel (.xlsx).");
    }

    if (headers.length === 0) return fail("No se encontraron encabezados en la primera fila");
    const totalRows = rows.length;
    if (totalRows === 0) return fail("El archivo no tiene filas de datos");

    return ok({
      headers,
      rows: rows.slice(0, MAX_ROWS),
      mapping: headers.map(guessField),
      totalRows,
    });
  } catch (err) {
    return fail(explain(err));
  }
}

export type PreviewRow = {
  index: number;
  values: Partial<Record<Exclude<ImportField, "ignorar">, string>>;
  status: "nuevo" | "duplicado" | "error";
  detail: string;
  existingId?: string;
  existingName?: string;
};

function buildValues(row: string[], mapping: ImportField[]) {
  const values: Partial<Record<Exclude<ImportField, "ignorar">, string>> = {};
  mapping.forEach((field, index) => {
    if (field === "ignorar") return;
    const raw = (row[index] ?? "").trim();
    if (raw) values[field] = raw;
  });
  return values;
}

/** Paso 3: vista previa con validacion y duplicados marcados. */
export async function previewImport(
  entity: "contactos" | "empresas",
  rows: string[][],
  mapping: ImportField[],
): Promise<Result<{ preview: PreviewRow[]; counts: Record<string, number> }>> {
  try {
    await requireUser();
    const db = await getDb();

    const existingContacts = await db
      .select({
        id: contacts.id,
        fullName: contacts.fullName,
        email: contacts.emailNormalized,
        phone: contacts.phoneNormalized,
      })
      .from(contacts)
      .where(isNull(contacts.deletedAt));
    const existingCompanies = await db
      .select({ id: companies.id, name: companies.name, domain: companies.domain })
      .from(companies)
      .where(isNull(companies.deletedAt));

    const byEmail = new Map(existingContacts.filter((c) => c.email).map((c) => [c.email!, c]));
    const byPhone = new Map(existingContacts.filter((c) => c.phone).map((c) => [c.phone!, c]));
    const byCompanyKey = new Map(existingCompanies.map((c) => [companyKey(c.name), c]));
    const byDomain = new Map(existingCompanies.filter((c) => c.domain).map((c) => [c.domain!, c]));

    // Duplicados dentro del propio archivo, no solo contra la base.
    const seenEmails = new Set<string>();
    const seenPhones = new Set<string>();
    const seenCompanies = new Set<string>();

    const preview: PreviewRow[] = rows.map((row, index) => {
      const values = buildValues(row, mapping);

      if (entity === "empresas") {
        const name = values.empresa ?? values.nombre;
        if (!name) {
          return { index, values, status: "error", detail: "Falta el nombre de la empresa" };
        }
        const key = companyKey(name);
        const domain = domainFromWebsite(values.sitioWeb);
        const match = byCompanyKey.get(key) ?? (domain ? byDomain.get(domain) : undefined);
        if (match) {
          return {
            index,
            values,
            status: "duplicado",
            detail: "Ya existe en el CRM. Se completan los campos que esten vacios.",
            existingId: match.id,
            existingName: match.name,
          };
        }
        if (seenCompanies.has(key)) {
          return { index, values, status: "duplicado", detail: "Repetida dentro del mismo archivo" };
        }
        seenCompanies.add(key);
        return { index, values, status: "nuevo", detail: "Se va a crear" };
      }

      if (!values.nombre) {
        return { index, values, status: "error", detail: "Falta el nombre del contacto" };
      }
      if (values.correo && !normalizeEmail(values.correo)) {
        return { index, values, status: "error", detail: `El correo "${values.correo}" no es valido` };
      }

      const email = normalizeEmail(values.correo);
      const phone = normalizePhone(values.telefono);
      const match = (email ? byEmail.get(email) : undefined) ?? (phone ? byPhone.get(phone) : undefined);
      if (match) {
        return {
          index,
          values,
          status: "duplicado",
          detail: "Ya existe en el CRM. Se completan los campos que esten vacios.",
          existingId: match.id,
          existingName: match.fullName,
        };
      }
      if ((email && seenEmails.has(email)) || (phone && seenPhones.has(phone))) {
        return { index, values, status: "duplicado", detail: "Repetido dentro del mismo archivo" };
      }
      if (email) seenEmails.add(email);
      if (phone) seenPhones.add(phone);
      return { index, values, status: "nuevo", detail: "Se va a crear" };
    });

    const counts = {
      nuevos: preview.filter((p) => p.status === "nuevo").length,
      duplicados: preview.filter((p) => p.status === "duplicado").length,
      errores: preview.filter((p) => p.status === "error").length,
    };

    return ok({ preview, counts });
  } catch (err) {
    return fail(explain(err));
  }
}

export type ImportResult = {
  imported: number;
  updated: number;
  duplicates: number;
  errors: number;
  log: { row: number; status: string; detail: string }[];
};

/** Paso 4: importar de verdad. */
export async function runImport(
  entity: "contactos" | "empresas",
  rows: string[][],
  mapping: ImportField[],
  options: { filename: string; updateExisting: boolean },
): Promise<Result<ImportResult>> {
  try {
    const me = await requireUser();
    const db = await getDb();
    const previewResult = await previewImport(entity, rows, mapping);
    if (!previewResult.ok) return previewResult;
    const { preview } = previewResult.data;

    // Catalogos, para resolver fuentes, campanas y productos por nombre.
    const [sourceRows, campaignRows, productRows] = await Promise.all([
      db.select({ id: leadSources.id, name: leadSources.name }).from(leadSources),
      db.select({ id: campaigns.id, name: campaigns.name }).from(campaigns),
      db.select({ id: products.id, name: products.name }).from(products).where(isNull(products.deletedAt)),
    ]);
    const findBy = <T extends { id: string; name: string }>(list: T[], value?: string) =>
      value ? list.find((item) => foldCase(item.name) === foldCase(value))?.id ?? null : null;

    const result: ImportResult = { imported: 0, updated: 0, duplicates: 0, errors: 0, log: [] };
    const touched: string[] = [];

    for (const row of preview) {
      const v = row.values;
      const line = row.index + 2; // +1 por el encabezado, +1 porque las filas se cuentan desde 1.

      if (row.status === "error") {
        result.errors += 1;
        result.log.push({ row: line, status: "error", detail: row.detail });
        continue;
      }

      if (row.status === "duplicado" && !row.existingId) {
        result.duplicates += 1;
        result.log.push({ row: line, status: "duplicado", detail: row.detail });
        continue;
      }

      try {
        if (entity === "empresas") {
          const name = (v.empresa ?? v.nombre)!;
          const website = normalizeWebsite(v.sitioWeb);
          if (row.existingId) {
            if (!options.updateExisting) {
              result.duplicates += 1;
              result.log.push({ row: line, status: "duplicado", detail: "Ya existia, no se modificó" });
              continue;
            }
            // Solo se rellena lo que esta vacio: nunca se pisa un dato bueno.
            await db
              .update(companies)
              .set({
                website: sql`coalesce(${companies.website}, ${website})`,
                domain: sql`coalesce(${companies.domain}, ${domainFromWebsite(website)})`,
                industry: sql`coalesce(${companies.industry}, ${v.sector ?? null})`,
                city: sql`coalesce(${companies.city}, ${v.ciudad ?? null})`,
                country: sql`coalesce(${companies.country}, ${normalizeCountry(v.pais)})`,
                notes: sql`coalesce(${companies.notes}, ${v.notas ?? null})`,
                updatedBy: me.id,
                updatedAt: new Date(),
              })
              .where(eq(companies.id, row.existingId));
            result.updated += 1;
            result.log.push({ row: line, status: "actualizado", detail: `Se completo ${row.existingName}` });
          } else {
            await db.insert(companies).values({
              name: normalizeName(name),
              website,
              domain: domainFromWebsite(website),
              industry: v.sector ?? null,
              city: v.ciudad ?? null,
              country: normalizeCountry(v.pais),
              notes: v.notas ?? null,
              sourceId: findBy(sourceRows, v.fuente),
              responsibleId: me.id,
              createdBy: me.id,
              updatedBy: me.id,
            });
            result.imported += 1;
            result.log.push({ row: line, status: "creado", detail: name });
          }
          continue;
        }

        // Contactos
        const email = normalizeEmail(v.correo);
        const phone = normalizePhone(v.telefono);
        let companyId: string | null = null;
        if (v.empresa) {
          const key = companyKey(v.empresa);
          const all = await db
            .select({ id: companies.id, name: companies.name })
            .from(companies)
            .where(isNull(companies.deletedAt));
          companyId = all.find((c) => companyKey(c.name) === key)?.id ?? null;
          if (!companyId) {
            const [created] = await db
              .insert(companies)
              .values({
                name: normalizeName(v.empresa),
                domain: corporateDomain(email),
                city: v.ciudad ?? null,
                country: normalizeCountry(v.pais),
                responsibleId: me.id,
                createdBy: me.id,
                updatedBy: me.id,
              })
              .returning({ id: companies.id });
            companyId = created!.id;
          }
        }

        const segment = normalizeSegment(v.tipo) ?? (companyId ? "b2b" : "b2c");

        if (row.existingId) {
          if (!options.updateExisting) {
            result.duplicates += 1;
            result.log.push({ row: line, status: "duplicado", detail: "Ya existia, no se modificó" });
            continue;
          }
          await db
            .update(contacts)
            .set({
              email: sql`coalesce(${contacts.email}, ${email})`,
              emailNormalized: sql`coalesce(${contacts.emailNormalized}, ${email})`,
              phone: sql`coalesce(${contacts.phone}, ${v.telefono ?? null})`,
              phoneNormalized: sql`coalesce(${contacts.phoneNormalized}, ${phone})`,
              companyId: sql`coalesce(${contacts.companyId}, ${companyId})`,
              position: sql`coalesce(${contacts.position}, ${v.cargo ?? null})`,
              city: sql`coalesce(${contacts.city}, ${v.ciudad ?? null})`,
              country: sql`coalesce(${contacts.country}, ${normalizeCountry(v.pais)})`,
              notes: sql`coalesce(${contacts.notes}, ${v.notas ?? null})`,
              updatedBy: me.id,
              updatedAt: new Date(),
            })
            .where(eq(contacts.id, row.existingId));
          touched.push(row.existingId);
          result.updated += 1;
          result.log.push({ row: line, status: "actualizado", detail: `Se completo ${row.existingName}` });
        } else {
          const [created] = await db
            .insert(contacts)
            .values({
              fullName: normalizeName(v.nombre!),
              email,
              emailNormalized: email,
              phone: v.telefono ?? null,
              phoneNormalized: phone,
              companyId,
              position: v.cargo ?? null,
              city: v.ciudad ?? null,
              country: normalizeCountry(v.pais),
              segment,
              sourceId: findBy(sourceRows, v.fuente),
              firstTouchSourceId: findBy(sourceRows, v.fuente),
              lastTouchSourceId: findBy(sourceRows, v.fuente),
              campaignId: findBy(campaignRows, v.campana),
              interestProductId: findBy(productRows, v.producto),
              notes: v.notas ?? null,
              responsibleId: me.id,
              createdBy: me.id,
              updatedBy: me.id,
            })
            .returning({ id: contacts.id });
          touched.push(created!.id);
          result.imported += 1;
          result.log.push({ row: line, status: "creado", detail: v.nombre! });
        }
      } catch (err) {
        result.errors += 1;
        result.log.push({
          row: line,
          status: "error",
          detail: err instanceof Error ? err.message.slice(0, 160) : "Error al guardar",
        });
      }
    }

    for (const id of touched.slice(0, 400)) {
      try {
        await recalcLeadScore(id);
      } catch {
        // Un puntaje que falla no debe tumbar la importacion completa.
      }
    }

    await db.insert(importBatches).values({
      userId: me.id,
      filename: options.filename,
      entity,
      imported: result.imported,
      updated: result.updated,
      duplicates: result.duplicates,
      errors: result.errors,
      log: result.log.slice(0, 500),
    });

    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "importar",
      entityType: entity === "contactos" ? "contacto" : "empresa",
      entityId: options.filename,
      summary: `Importo ${options.filename}: ${result.imported} creados, ${result.updated} actualizados, ${result.duplicates} duplicados, ${result.errors} con error`,
    });

    return ok(result);
  } catch (err) {
    return fail(explain(err));
  }
}
