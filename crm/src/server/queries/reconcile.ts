import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { cohorts, companies, contacts, opportunities } from "@/db/schema";
import { toNumber } from "@/lib/money";
import type { Currency } from "@/db/enums";

export type PorConciliarFila = {
  id: string;
  name: string;
  contactId: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  companyId: string | null;
  companyName: string | null;
  amount: number;
  currency: Currency;
  hoja: string | null;
  fila: string | null;
};

export type PorConciliarGrupo = {
  cohortId: string | null;
  cohortName: string;
  startsOn: string | null;
  dateApproximate: boolean;
  total: number;
  filas: PorConciliarFila[];
};

/**
 * Negocios ganados cuyo pago nadie ha cruzado todavia contra una factura o un
 * extracto. Agrupados por cohorte, que es como se concilia: una lista de
 * asistentes contra las facturas FAN y el reporte de Bold de esas fechas.
 */
export async function pagosPorConciliar(): Promise<{ grupos: PorConciliarGrupo[]; total: number; cantidad: number }> {
  const db = await getDb();
  const rows = await db
    .select({
      id: opportunities.id,
      name: opportunities.name,
      amount: opportunities.amount,
      currency: opportunities.currency,
      importMeta: opportunities.importMeta,
      contactId: opportunities.contactId,
      contactName: contacts.fullName,
      email: contacts.email,
      phone: contacts.phone,
      companyId: opportunities.companyId,
      companyName: companies.name,
      cohortId: cohorts.id,
      cohortName: cohorts.name,
      startsOn: cohorts.startsOn,
      dateApproximate: cohorts.dateApproximate,
    })
    .from(opportunities)
    .leftJoin(contacts, eq(opportunities.contactId, contacts.id))
    .leftJoin(companies, eq(opportunities.companyId, companies.id))
    .leftJoin(cohorts, eq(opportunities.cohortId, cohorts.id))
    .where(
      and(
        eq(opportunities.stage, "ganado"),
        eq(opportunities.paymentStatus, "por-conciliar"),
        isNull(opportunities.deletedAt),
      ),
    );

  const grupos = new Map<string, PorConciliarGrupo>();
  for (const r of rows) {
    const key = r.cohortId ?? "sin-cohorte";
    const g = grupos.get(key) ?? {
      cohortId: r.cohortId,
      cohortName: r.cohortName ?? "Sin cohorte",
      startsOn: r.startsOn,
      dateApproximate: r.dateApproximate ?? false,
      total: 0,
      filas: [],
    };
    const amount = toNumber(r.amount);
    g.total += r.currency === "COP" ? amount : 0;
    g.filas.push({
      id: r.id,
      name: r.name,
      contactId: r.contactId,
      contactName: r.contactName,
      email: r.email,
      phone: r.phone,
      companyId: r.companyId,
      companyName: r.companyName,
      amount,
      currency: r.currency,
      hoja: r.importMeta?.hoja != null ? String(r.importMeta.hoja) : null,
      fila: r.importMeta?.fila != null ? String(r.importMeta.fila) : null,
    });
    grupos.set(key, g);
  }

  const lista = [...grupos.values()];
  for (const g of lista) {
    g.filas.sort((a, b) =>
      (a.companyName ?? "~").localeCompare(b.companyName ?? "~", "es") ||
      (a.contactName ?? "").localeCompare(b.contactName ?? "", "es"),
    );
  }
  // En orden de fecha: asi se revisan las facturas del tio, mes por mes.
  lista.sort((a, b) => (a.startsOn ?? "9999").localeCompare(b.startsOn ?? "9999"));
  return {
    grupos: lista,
    total: lista.reduce((acc, g) => acc + g.total, 0),
    cantidad: rows.length,
  };
}
