import "server-only";
import { aliasedTable, and, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  campaigns,
  companies,
  contacts,
  invoices,
  leadSources,
  opportunities,
  payments,
  products,
  proposals,
  users,
} from "@/db/schema";
import { getStages } from "@/lib/pipeline";
import { financeSettings } from "@/lib/settings";
import { toNumber } from "@/lib/money";
import { formatDateInput, toDate } from "@/lib/dates";

const responsible = aliasedTable(users, "responsable");

export type ReportFilters = {
  from?: string;
  to?: string;
  responsibleId?: string;
  productId?: string;
  segment?: string;
  sourceId?: string;
  campaignId?: string;
  country?: string;
  stage?: string;
};

export type Breakdown = { key: string; label: string; count: number; value: number };

/**
 * Reportes con pocas metricas pero utiles. Todo se calcula sobre el mismo
 * conjunto filtrado, para que los numeros de una pantalla no contradigan otra.
 */
export async function buildReport(filters: ReportFilters) {
  const db = await getDb();
  const { usdRate } = await financeSettings();
  const stages = await getStages();
  const stageKind = new Map(stages.map((s) => [s.slug, s.kind]));
  const stageName = new Map(stages.map((s) => [s.slug, s.name]));

  const cop = (amount: string | number, currency: string) =>
    toNumber(amount) * (currency === "USD" ? usdRate : 1);

  const from = filters.from ? toDate(filters.from) : null;
  const to = filters.to ? new Date(`${filters.to}T23:59:59`) : null;

  const oppWhere = [isNull(opportunities.deletedAt)];
  if (from) oppWhere.push(gte(opportunities.createdAt, from));
  if (to) oppWhere.push(lte(opportunities.createdAt, to));
  if (filters.responsibleId) oppWhere.push(eq(opportunities.responsibleId, filters.responsibleId));
  if (filters.productId) oppWhere.push(eq(opportunities.productId, filters.productId));
  if (filters.segment) oppWhere.push(eq(opportunities.segment, filters.segment as "b2b"));
  if (filters.sourceId) oppWhere.push(eq(opportunities.sourceId, filters.sourceId));
  if (filters.campaignId) oppWhere.push(eq(opportunities.campaignId, filters.campaignId));
  if (filters.stage) oppWhere.push(eq(opportunities.stage, filters.stage));

  const opps = await db
    .select({
      id: opportunities.id,
      amount: opportunities.amount,
      currency: opportunities.currency,
      stage: opportunities.stage,
      probability: opportunities.probability,
      segment: opportunities.segment,
      createdAt: opportunities.createdAt,
      closedAt: opportunities.closedAt,
      lostReason: opportunities.lostReason,
      productName: products.name,
      sourceName: leadSources.name,
      campaignName: campaigns.name,
      responsibleName: responsible.name,
      companyCountry: companies.country,
    })
    .from(opportunities)
    .leftJoin(products, eq(opportunities.productId, products.id))
    .leftJoin(leadSources, eq(opportunities.sourceId, leadSources.id))
    .leftJoin(campaigns, eq(opportunities.campaignId, campaigns.id))
    .leftJoin(responsible, eq(opportunities.responsibleId, responsible.id))
    .leftJoin(companies, eq(opportunities.companyId, companies.id))
    .where(and(...oppWhere));

  const filtered = filters.country
    ? opps.filter((o) => o.companyCountry === filters.country)
    : opps;

  const active = filtered.filter((o) => stageKind.get(o.stage) === "activa");
  const won = filtered.filter((o) => stageKind.get(o.stage) === "ganado");
  const lost = filtered.filter((o) => stageKind.get(o.stage) === "perdido");

  const pipelineValue = active.reduce((a, o) => a + cop(o.amount, o.currency), 0);
  const weighted = active.reduce((a, o) => a + cop(o.amount, o.currency) * (o.probability / 100), 0);
  const wonValue = won.reduce((a, o) => a + cop(o.amount, o.currency), 0);
  const lostValue = lost.reduce((a, o) => a + cop(o.amount, o.currency), 0);

  const decided = won.length + lost.length;
  const conversionRate = decided > 0 ? (won.length / decided) * 100 : 0;
  const averageDeal = won.length > 0 ? wonValue / won.length : 0;

  const closeDays = won
    .filter((o) => o.closedAt)
    .map((o) => Math.max(0, Math.round((o.closedAt!.getTime() - o.createdAt.getTime()) / 86_400_000)));
  const averageCloseDays =
    closeDays.length > 0 ? Math.round(closeDays.reduce((a, d) => a + d, 0) / closeDays.length) : 0;

  // ───────── Contactos y leads ─────────
  const contactWhere = [isNull(contacts.deletedAt)];
  if (from) contactWhere.push(gte(contacts.createdAt, from));
  if (to) contactWhere.push(lte(contacts.createdAt, to));
  if (filters.responsibleId) contactWhere.push(eq(contacts.responsibleId, filters.responsibleId));
  if (filters.segment) contactWhere.push(eq(contacts.segment, filters.segment as "b2b"));
  if (filters.sourceId) contactWhere.push(eq(contacts.sourceId, filters.sourceId));
  if (filters.campaignId) contactWhere.push(eq(contacts.campaignId, filters.campaignId));

  const contactRows = await db
    .select({
      id: contacts.id,
      status: contacts.status,
      segment: contacts.segment,
      sourceName: leadSources.name,
      campaignName: campaigns.name,
      country: contacts.country,
    })
    .from(contacts)
    .leftJoin(leadSources, eq(contacts.sourceId, leadSources.id))
    .leftJoin(campaigns, eq(contacts.campaignId, campaigns.id))
    .where(and(...contactWhere));

  const qualified = contactRows.filter((c) =>
    ["calificado", "oportunidad", "cliente"].includes(c.status),
  );

  // ───────── Cobranza ─────────
  const paymentRows = await db
    .select({
      amount: payments.amount,
      currency: payments.currency,
      paidOn: payments.paidOn,
      status: payments.status,
    })
    .from(payments)
    .where(isNull(payments.deletedAt));

  const collected = paymentRows
    .filter(
      (p) =>
        p.paidOn &&
        p.status !== "reembolsado" &&
        (!filters.from || p.paidOn >= filters.from) &&
        (!filters.to || p.paidOn <= filters.to),
    )
    .reduce((a, p) => a + cop(p.amount, p.currency), 0);

  const pendingCollection = paymentRows
    .filter((p) => !p.paidOn && p.status !== "reembolsado")
    .reduce((a, p) => a + cop(p.amount, p.currency), 0);

  // ───────── Propuestas ─────────
  const proposalWhere = [isNull(proposals.deletedAt)];
  if (from) proposalWhere.push(gte(proposals.createdAt, from));
  if (to) proposalWhere.push(lte(proposals.createdAt, to));
  if (filters.responsibleId) proposalWhere.push(eq(proposals.responsibleId, filters.responsibleId));

  const proposalRows = await db
    .select({ status: proposals.status, amount: proposals.amount, currency: proposals.currency })
    .from(proposals)
    .where(and(...proposalWhere));

  const sentProposals = proposalRows.filter((p) => p.status !== "borrador" && p.status !== "lista-para-enviar");
  const acceptedProposals = proposalRows.filter((p) => p.status === "aceptada");
  const proposalConversion =
    sentProposals.length > 0 ? (acceptedProposals.length / sentProposals.length) * 100 : 0;

  // ───────── Desgloses ─────────
  function group(
    rows: typeof filtered,
    key: (row: (typeof filtered)[number]) => string | null,
    onlyWon = false,
  ): Breakdown[] {
    const map = new Map<string, Breakdown>();
    for (const row of rows) {
      if (onlyWon && stageKind.get(row.stage) !== "ganado") continue;
      const label = key(row) ?? "Sin definir";
      const entry = map.get(label) ?? { key: label, label, count: 0, value: 0 };
      entry.count += 1;
      entry.value += cop(row.amount, row.currency);
      map.set(label, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.value - a.value);
  }

  const byStage: Breakdown[] = stages
    .filter((s) => s.kind === "activa")
    .map((s) => {
      const rows = active.filter((o) => o.stage === s.slug);
      return {
        key: s.slug,
        label: s.name,
        count: rows.length,
        value: rows.reduce((a, o) => a + cop(o.amount, o.currency), 0),
      };
    });

  const leadsBySource = countBy(contactRows, (c) => c.sourceName ?? "Sin definir");
  const leadsByCampaign = countBy(contactRows, (c) => c.campaignName ?? "Sin campaña");

  return {
    totals: {
      newLeads: contactRows.length,
      qualifiedLeads: qualified.length,
      activeDeals: active.length,
      pipelineValue,
      weighted,
      wonCount: won.length,
      wonValue,
      lostCount: lost.length,
      lostValue,
      conversionRate,
      averageDeal,
      averageCloseDays,
      collected,
      pendingCollection,
      proposalsSent: sentProposals.length,
      proposalsAccepted: acceptedProposals.length,
      proposalConversion,
      b2bCount: filtered.filter((o) => o.segment === "b2b").length,
      b2cCount: filtered.filter((o) => o.segment === "b2c").length,
      b2bValue: filtered.filter((o) => o.segment === "b2b").reduce((a, o) => a + cop(o.amount, o.currency), 0),
      b2cValue: filtered.filter((o) => o.segment === "b2c").reduce((a, o) => a + cop(o.amount, o.currency), 0),
    },
    breakdowns: {
      byStage,
      revenueByProduct: group(filtered, (o) => o.productName, true),
      revenueBySource: group(filtered, (o) => o.sourceName, true),
      revenueByCampaign: group(filtered, (o) => o.campaignName, true),
      pipelineByResponsible: group(active, (o) => o.responsibleName),
      lostReasons: group(lost, (o) => o.lostReason),
      leadsBySource,
      leadsByCampaign,
    },
  };
}

function countBy<T>(rows: T[], key: (row: T) => string): Breakdown[] {
  const map = new Map<string, Breakdown>();
  for (const row of rows) {
    const label = key(row);
    const entry = map.get(label) ?? { key: label, label, count: 0, value: 0 };
    entry.count += 1;
    map.set(label, entry);
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

export type Report = Awaited<ReturnType<typeof buildReport>>;
