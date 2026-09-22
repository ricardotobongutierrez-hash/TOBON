import "server-only";
import { aliasedTable, and, asc, count, desc, eq, gte, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
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
  tasks,
  users,
} from "@/db/schema";
import type { SessionUser } from "@/lib/auth";
import { getStages } from "@/lib/pipeline";
import { toNumber } from "@/lib/money";
import { financeSettings } from "@/lib/settings";

const responsible = aliasedTable(users, "responsable");

/**
 * "Próxima acción" no es una columna: es el pendiente abierto mas cercano.
 * Derivarla en un solo lugar evita que un contacto diga una cosa y su pendiente
 * diga otra.
 */
function nextActionSql(column: "contact_id" | "opportunity_id" | "company_id", id: unknown) {
  return sql<string | null>`(
    select ${tasks.title} from ${tasks}
    where ${tasks}.${sql.raw(column)} = ${id}
      and ${tasks.status} = 'abierta' and ${tasks.deletedAt} is null
    order by ${tasks.dueAt} asc nulls last limit 1
  )`;
}

function nextActionDateSql(column: "contact_id" | "opportunity_id" | "company_id", id: unknown) {
  return sql<Date | null>`(
    select ${tasks.dueAt} from ${tasks}
    where ${tasks}.${sql.raw(column)} = ${id}
      and ${tasks.status} = 'abierta' and ${tasks.deletedAt} is null
    order by ${tasks.dueAt} asc nulls last limit 1
  )`;
}

// ───────────────────────── Contactos ─────────────────────────

export type ContactFilters = {
  q?: string;
  segment?: string;
  status?: string;
  responsibleId?: string;
  sourceId?: string;
  campaignId?: string;
  companyId?: string;
  productId?: string;
  country?: string;
  sort?: string;
  page?: number;
  perPage?: number;
  archived?: boolean;
};

export async function listContacts(filters: ContactFilters) {
  const db = await getDb();
  const perPage = Math.min(filters.perPage ?? 25, 200);
  const page = Math.max(1, filters.page ?? 1);

  const where = [filters.archived ? sql`${contacts.deletedAt} is not null` : isNull(contacts.deletedAt)];
  if (filters.q) {
    const like = `%${filters.q}%`;
    where.push(
      or(
        ilike(contacts.fullName, like),
        ilike(contacts.email, like),
        ilike(contacts.phone, like),
        ilike(contacts.position, like),
        ilike(companies.name, like),
      )!,
    );
  }
  if (filters.segment) where.push(eq(contacts.segment, filters.segment as "b2b"));
  if (filters.status) where.push(eq(contacts.status, filters.status as "nuevo"));
  if (filters.responsibleId) where.push(eq(contacts.responsibleId, filters.responsibleId));
  if (filters.sourceId) where.push(eq(contacts.sourceId, filters.sourceId));
  if (filters.campaignId) where.push(eq(contacts.campaignId, filters.campaignId));
  if (filters.companyId) where.push(eq(contacts.companyId, filters.companyId));
  if (filters.productId) where.push(eq(contacts.interestProductId, filters.productId));
  if (filters.country) where.push(eq(contacts.country, filters.country));

  const order = {
    nombre: asc(contacts.fullName),
    reciente: desc(contacts.createdAt),
    puntaje: desc(contacts.leadScore),
    interaccion: sql`${contacts.lastInteractionAt} desc nulls last`,
  }[filters.sort ?? "reciente"] ?? desc(contacts.createdAt);

  const rows = await db
    .select({
      id: contacts.id,
      fullName: contacts.fullName,
      email: contacts.email,
      phone: contacts.phone,
      position: contacts.position,
      city: contacts.city,
      country: contacts.country,
      segment: contacts.segment,
      status: contacts.status,
      leadScore: contacts.leadScore,
      leadScoreManual: contacts.leadScoreManual,
      leadScoreBreakdown: contacts.leadScoreBreakdown,
      lastInteractionAt: contacts.lastInteractionAt,
      createdAt: contacts.createdAt,
      isDemo: contacts.isDemo,
      companyId: contacts.companyId,
      companyName: companies.name,
      responsibleName: responsible.name,
      sourceName: leadSources.name,
      campaignName: campaigns.name,
      productName: products.name,
      nextAction: nextActionSql("contact_id", contacts.id),
      nextActionDate: nextActionDateSql("contact_id", contacts.id),
    })
    .from(contacts)
    .leftJoin(companies, eq(contacts.companyId, companies.id))
    .leftJoin(responsible, eq(contacts.responsibleId, responsible.id))
    .leftJoin(leadSources, eq(contacts.sourceId, leadSources.id))
    .leftJoin(campaigns, eq(contacts.campaignId, campaigns.id))
    .leftJoin(products, eq(contacts.interestProductId, products.id))
    .where(and(...where))
    .orderBy(order)
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [total] = await db
    .select({ n: count() })
    .from(contacts)
    .leftJoin(companies, eq(contacts.companyId, companies.id))
    .where(and(...where));

  return { rows, total: total?.n ?? 0, page, perPage };
}

export type ContactRow = Awaited<ReturnType<typeof listContacts>>["rows"][number];

// ───────────────────────── Empresas ─────────────────────────

export type CompanyFilters = {
  q?: string;
  industry?: string;
  country?: string;
  responsibleId?: string;
  capacity?: string;
  sort?: string;
  page?: number;
  perPage?: number;
};

export async function listCompanies(filters: CompanyFilters) {
  const db = await getDb();
  const perPage = Math.min(filters.perPage ?? 25, 200);
  const page = Math.max(1, filters.page ?? 1);

  const where = [isNull(companies.deletedAt)];
  if (filters.q) {
    const like = `%${filters.q}%`;
    where.push(or(ilike(companies.name, like), ilike(companies.website, like), ilike(companies.industry, like))!);
  }
  if (filters.industry) where.push(eq(companies.industry, filters.industry));
  if (filters.country) where.push(eq(companies.country, filters.country));
  if (filters.responsibleId) where.push(eq(companies.responsibleId, filters.responsibleId));
  if (filters.capacity) where.push(eq(companies.purchasingCapacity, filters.capacity as "alta"));

  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      website: companies.website,
      industry: companies.industry,
      country: companies.country,
      city: companies.city,
      size: companies.size,
      purchasingCapacity: companies.purchasingCapacity,
      createdAt: companies.createdAt,
      isDemo: companies.isDemo,
      responsibleName: responsible.name,
      contactCount: sql<number>`(
        select count(*)::int from ${contacts}
        where ${contacts.companyId} = ${companies.id} and ${contacts.deletedAt} is null
      )`,
      openDeals: sql<number>`(
        select count(*)::int from ${opportunities}
        where ${opportunities.companyId} = ${companies.id} and ${opportunities.deletedAt} is null
          and ${opportunities.closedAt} is null
      )`,
      openValue: sql<string>`(
        select coalesce(sum(${opportunities.amount}), 0) from ${opportunities}
        where ${opportunities.companyId} = ${companies.id} and ${opportunities.deletedAt} is null
          and ${opportunities.closedAt} is null
      )`,
    })
    .from(companies)
    .leftJoin(responsible, eq(companies.responsibleId, responsible.id))
    .where(and(...where))
    .orderBy(
      { nombre: asc(companies.name), reciente: desc(companies.createdAt) }[filters.sort ?? "nombre"] ??
        asc(companies.name),
    )
    .limit(perPage)
    .offset((page - 1) * perPage);

  const [total] = await db.select({ n: count() }).from(companies).where(and(...where));
  return { rows, total: total?.n ?? 0, page, perPage };
}

export type CompanyRow = Awaited<ReturnType<typeof listCompanies>>["rows"][number];

// ───────────────────────── Negocios ─────────────────────────

export type OpportunityFilters = {
  q?: string;
  stage?: string;
  segment?: string;
  responsibleId?: string;
  productId?: string;
  sourceId?: string;
  campaignId?: string;
  onlyOpen?: boolean;
  missingNextAction?: boolean;
};

export async function listOpportunities(filters: OpportunityFilters = {}) {
  const db = await getDb();
  const stages = await getStages();
  const activeSlugs = stages.filter((s) => s.kind === "activa").map((s) => s.slug);

  const where = [isNull(opportunities.deletedAt)];
  if (filters.q) {
    const like = `%${filters.q}%`;
    where.push(or(ilike(opportunities.name, like), ilike(companies.name, like), ilike(contacts.fullName, like))!);
  }
  if (filters.stage) where.push(eq(opportunities.stage, filters.stage));
  if (filters.segment) where.push(eq(opportunities.segment, filters.segment as "b2b"));
  if (filters.responsibleId) where.push(eq(opportunities.responsibleId, filters.responsibleId));
  if (filters.productId) where.push(eq(opportunities.productId, filters.productId));
  if (filters.sourceId) where.push(eq(opportunities.sourceId, filters.sourceId));
  if (filters.campaignId) where.push(eq(opportunities.campaignId, filters.campaignId));
  if (filters.onlyOpen && activeSlugs.length > 0) where.push(inArray(opportunities.stage, activeSlugs));

  const rows = await db
    .select({
      id: opportunities.id,
      name: opportunities.name,
      amount: opportunities.amount,
      currency: opportunities.currency,
      taxRate: opportunities.taxRate,
      requiresInvoice: opportunities.requiresInvoice,
      stage: opportunities.stage,
      stageChangedAt: opportunities.stageChangedAt,
      probability: opportunities.probability,
      expectedCloseOn: opportunities.expectedCloseOn,
      segment: opportunities.segment,
      proposalStatus: opportunities.proposalStatus,
      billingStatus: opportunities.billingStatus,
      paymentStatus: opportunities.paymentStatus,
      deliveryStatus: opportunities.deliveryStatus,
      lastInteractionAt: opportunities.lastInteractionAt,
      closedAt: opportunities.closedAt,
      lostReason: opportunities.lostReason,
      createdAt: opportunities.createdAt,
      isDemo: opportunities.isDemo,
      contactId: opportunities.contactId,
      contactName: contacts.fullName,
      companyId: opportunities.companyId,
      companyName: companies.name,
      productName: products.name,
      responsibleId: opportunities.responsibleId,
      responsibleName: responsible.name,
      sourceName: leadSources.name,
      campaignName: campaigns.name,
      nextAction: nextActionSql("opportunity_id", opportunities.id),
      nextActionDate: nextActionDateSql("opportunity_id", opportunities.id),
    })
    .from(opportunities)
    .leftJoin(contacts, eq(opportunities.contactId, contacts.id))
    .leftJoin(companies, eq(opportunities.companyId, companies.id))
    .leftJoin(products, eq(opportunities.productId, products.id))
    .leftJoin(responsible, eq(opportunities.responsibleId, responsible.id))
    .leftJoin(leadSources, eq(opportunities.sourceId, leadSources.id))
    .leftJoin(campaigns, eq(opportunities.campaignId, campaigns.id))
    .where(and(...where))
    .orderBy(desc(opportunities.amount))
    .limit(600);

  return filters.missingNextAction ? rows.filter((r) => !r.nextAction) : rows;
}

export type OpportunityRow = Awaited<ReturnType<typeof listOpportunities>>[number];

/** Valor en pesos de un negocio, para poder sumar COP y USD en un mismo total. */
export async function copValue(rows: { amount: string; currency: string }[]): Promise<number> {
  const { usdRate } = await financeSettings();
  return rows.reduce((acc, r) => acc + toNumber(r.amount) * (r.currency === "USD" ? usdRate : 1), 0);
}

// ───────────────────────── Pendientes ─────────────────────────

export type TaskRow = {
  id: string;
  title: string;
  kind: string;
  dueAt: Date | null;
  waitingFor: string;
  notes: string | null;
  status: string;
  contactId: string | null;
  contactName: string | null;
  companyId: string | null;
  companyName: string | null;
  opportunityId: string | null;
  opportunityName: string | null;
  opportunityAmount: string | null;
  opportunityCurrency: string | null;
  responsibleId: string | null;
  responsibleName: string | null;
  isDemo: boolean;
};

export async function listTasks(options: {
  responsibleId?: string | null;
  status?: "abierta" | "hecha" | "cancelada";
  from?: Date;
  to?: Date;
  limit?: number;
} = {}): Promise<TaskRow[]> {
  const db = await getDb();
  const where = [isNull(tasks.deletedAt), eq(tasks.status, options.status ?? "abierta")];
  if (options.responsibleId) where.push(eq(tasks.responsibleId, options.responsibleId));
  if (options.from) where.push(gte(tasks.dueAt, options.from));
  if (options.to) where.push(lte(tasks.dueAt, options.to));

  return db
    .select({
      id: tasks.id,
      title: tasks.title,
      kind: tasks.kind,
      dueAt: tasks.dueAt,
      waitingFor: tasks.waitingFor,
      notes: tasks.notes,
      status: tasks.status,
      contactId: tasks.contactId,
      contactName: contacts.fullName,
      companyId: tasks.companyId,
      companyName: companies.name,
      opportunityId: tasks.opportunityId,
      opportunityName: opportunities.name,
      opportunityAmount: opportunities.amount,
      opportunityCurrency: opportunities.currency,
      responsibleId: tasks.responsibleId,
      responsibleName: responsible.name,
      isDemo: tasks.isDemo,
    })
    .from(tasks)
    .leftJoin(contacts, eq(tasks.contactId, contacts.id))
    .leftJoin(companies, eq(tasks.companyId, companies.id))
    .leftJoin(opportunities, eq(tasks.opportunityId, opportunities.id))
    .leftJoin(responsible, eq(tasks.responsibleId, responsible.id))
    .where(and(...where))
    .orderBy(sql`${tasks.dueAt} asc nulls last`)
    .limit(options.limit ?? 400);
}

// ───────────────────────── Propuestas ─────────────────────────

export async function listProposals(options: { status?: string[]; responsibleId?: string } = {}) {
  const db = await getDb();
  const where = [isNull(proposals.deletedAt)];
  if (options.status && options.status.length > 0) {
    where.push(inArray(proposals.status, options.status as ("enviada")[]));
  }
  if (options.responsibleId) where.push(eq(proposals.responsibleId, options.responsibleId));

  return db
    .select({
      id: proposals.id,
      number: proposals.number,
      title: proposals.title,
      amount: proposals.amount,
      currency: proposals.currency,
      status: proposals.status,
      currentVersion: proposals.currentVersion,
      sentAt: proposals.sentAt,
      respondedAt: proposals.respondedAt,
      expiresOn: proposals.expiresOn,
      createdAt: proposals.createdAt,
      isDemo: proposals.isDemo,
      opportunityId: proposals.opportunityId,
      contactId: proposals.contactId,
      contactName: contacts.fullName,
      companyId: proposals.companyId,
      companyName: companies.name,
      responsibleName: responsible.name,
      hasInvoice: sql<number>`(
        select count(*)::int from ${invoices}
        where ${invoices.opportunityId} = ${proposals.opportunityId} and ${invoices.deletedAt} is null
      )`,
      openFollowUps: sql<number>`(
        select count(*)::int from ${tasks}
        where ${tasks.proposalId} = ${proposals.id} and ${tasks.status} = 'abierta'
      )`,
    })
    .from(proposals)
    .leftJoin(contacts, eq(proposals.contactId, contacts.id))
    .leftJoin(companies, eq(proposals.companyId, companies.id))
    .leftJoin(responsible, eq(proposals.responsibleId, responsible.id))
    .where(and(...where))
    .orderBy(sql`${proposals.sentAt} desc nulls last`, desc(proposals.createdAt))
    .limit(300);
}

export type ProposalRow = Awaited<ReturnType<typeof listProposals>>[number];

// ───────────────── Alcance por usuario ─────────────────

/**
 * "Mis pendientes" frente a "Todo el equipo". Los permisos se mantienen simples:
 * todos ven la informacion comercial, y el filtro es de foco, no de seguridad.
 */
export function scopeOf(user: SessionUser, scope: string | undefined): string | null {
  return scope === "equipo" ? null : user.id;
}
