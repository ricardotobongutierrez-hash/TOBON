import { randomUUID } from "node:crypto";
import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  BillingStatus,
  ContactStatus,
  Currency,
  DeliveryStatus,
  InteractionKind,
  PaymentStatus,
  ProductCategory,
  ProposalStatus,
  PurchasingCapacity,
  Role,
  Segment,
  StageKind,
  TaskKind,
  WaitingFor,
} from "./enums";

/**
 * Los UUID se generan en la aplicacion y no con gen_random_uuid(): asi el mismo
 * esquema corre en Postgres administrado y en PGlite sin depender de pgcrypto.
 */
const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID());

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
/** Borrado suave: los registros comerciales no se pierden, se archivan. */
const deletedAt = () => timestamp("deleted_at", { withTimezone: true });
const money = (name: string) => numeric(name, { precision: 16, scale: 2 });

// ───────────────────────────── Usuarios ─────────────────────────────

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    role: text("role").$type<Role>().notNull().default("equipo"),
    photoUrl: text("photo_url"),
    phone: text("phone"),
    active: boolean("active").notNull().default(true),
    /** Preferencias de notificacion, en un solo jsonb para no llenar la tabla. */
    notifyPrefs: jsonb("notify_prefs")
      .$type<{ resumenDiario: boolean; vencidos: boolean; pagos: boolean }>()
      .notNull()
      .default({ resumenDiario: true, vencidos: true, pagos: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)],
);

// ──────────────────── Catalogos configurables ────────────────────

export const leadSources = pgTable(
  "lead_sources",
  {
    id: id(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    active: boolean("active").notNull().default(true),
    sort: integer("sort").notNull().default(100),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("lead_sources_slug_uq").on(t.slug)],
);

export const campaigns = pgTable(
  "campaigns",
  {
    id: id(),
    name: text("name").notNull(),
    sourceId: text("source_id").references(() => leadSources.id, { onDelete: "set null" }),
    channel: text("channel"),
    startsOn: date("starts_on"),
    endsOn: date("ends_on"),
    budget: money("budget"),
    currency: text("currency").$type<Currency>().notNull().default("COP"),
    active: boolean("active").notNull().default(true),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("campaigns_source_idx").on(t.sourceId)],
);

export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    kind: text("kind").$type<StageKind>().notNull().default("activa"),
    probability: integer("probability").notNull().default(0),
    sort: integer("sort").notNull().default(100),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("pipeline_stages_slug_uq").on(t.slug)],
);

export const products = pgTable(
  "products",
  {
    id: id(),
    name: text("name").notNull(),
    category: text("category").$type<ProductCategory>().notNull().default("otro"),
    audience: text("audience").$type<"b2b" | "b2c" | "ambos">().notNull().default("ambos"),
    description: text("description"),
    defaultPrice: money("default_price"),
    currency: text("currency").$type<Currency>().notNull().default("COP"),
    unit: text("unit"),
    /** El IVA del 19% se cobra solo a quien necesita factura electronica. */
    taxable: boolean("taxable").notNull().default(true),
    promoPrice: money("promo_price"),
    promoLabel: text("promo_label"),
    promoEndsOn: date("promo_ends_on"),
    active: boolean("active").notNull().default(true),
    sort: integer("sort").notNull().default(100),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index("products_category_idx").on(t.category)],
);

export const tags = pgTable(
  "tags",
  {
    id: id(),
    name: text("name").notNull(),
    color: text("color").notNull().default("mariner"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("tags_name_uq").on(t.name)],
);

// ────────────────────── Empresas y contactos ──────────────────────

export const companies = pgTable(
  "companies",
  {
    id: id(),
    name: text("name").notNull(),
    website: text("website"),
    /** Dominio normalizado: sirve para detectar duplicados y asociar correos. */
    domain: text("domain"),
    industry: text("industry"),
    country: text("country"),
    city: text("city"),
    size: text("size"),
    responsibleId: text("responsible_id").references(() => users.id, { onDelete: "set null" }),
    sourceId: text("source_id").references(() => leadSources.id, { onDelete: "set null" }),
    campaignId: text("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    purchasingCapacity: text("purchasing_capacity")
      .$type<PurchasingCapacity>()
      .notNull()
      .default("sin-definir"),
    notes: text("notes"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("companies_name_idx").on(t.name),
    index("companies_domain_idx").on(t.domain),
    index("companies_responsible_idx").on(t.responsibleId),
  ],
);

export const contacts = pgTable(
  "contacts",
  {
    id: id(),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    /** Solo digitos, con indicativo. Es la llave de deduplicacion con WhatsApp. */
    phoneNormalized: text("phone_normalized"),
    email: text("email"),
    emailNormalized: text("email_normalized"),
    companyId: text("company_id").references(() => companies.id, { onDelete: "set null" }),
    position: text("position"),
    city: text("city"),
    country: text("country"),
    segment: text("segment").$type<Segment>().notNull().default("b2c"),
    sourceId: text("source_id").references(() => leadSources.id, { onDelete: "set null" }),
    campaignId: text("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    /** Atribucion de primer y ultimo toque, separadas del origen declarado. */
    firstTouchSourceId: text("first_touch_source_id").references(() => leadSources.id, {
      onDelete: "set null",
    }),
    lastTouchSourceId: text("last_touch_source_id").references(() => leadSources.id, {
      onDelete: "set null",
    }),
    interestProductId: text("interest_product_id").references(() => products.id, {
      onDelete: "set null",
    }),
    responsibleId: text("responsible_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status").$type<ContactStatus>().notNull().default("nuevo"),
    leadScore: integer("lead_score").notNull().default(0),
    /** Si el usuario fija el puntaje a mano, el calculo automatico no lo sobreescribe. */
    leadScoreManual: integer("lead_score_manual"),
    leadScoreBreakdown: jsonb("lead_score_breakdown")
      .$type<{ factor: string; label: string; points: number; detail: string }[]>()
      .notNull()
      .default([]),
    notes: text("notes"),
    lastInteractionAt: timestamp("last_interaction_at", { withTimezone: true }),
    isDemo: boolean("is_demo").notNull().default(false),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("contacts_name_idx").on(t.fullName),
    index("contacts_email_idx").on(t.emailNormalized),
    index("contacts_phone_idx").on(t.phoneNormalized),
    index("contacts_company_idx").on(t.companyId),
    index("contacts_responsible_idx").on(t.responsibleId),
  ],
);

/** Una persona puede estar ligada a varias empresas. */
export const companyContacts = pgTable(
  "company_contacts",
  {
    companyId: text("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    role: text("role"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.contactId] })],
);

export const contactTags = pgTable(
  "contact_tags",
  {
    contactId: text("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "cascade" }),
    tagId: text("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.contactId, t.tagId] })],
);

// ─────────────────────────── Negocios ───────────────────────────

export const opportunities = pgTable(
  "opportunities",
  {
    id: id(),
    name: text("name").notNull(),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    companyId: text("company_id").references(() => companies.id, { onDelete: "set null" }),
    segment: text("segment").$type<Segment>().notNull().default("b2b"),
    productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
    amount: money("amount").notNull().default("0"),
    currency: text("currency").$type<Currency>().notNull().default("COP"),
    /** El IVA se guarda aparte porque solo aplica a quien pide factura electronica. */
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    requiresInvoice: boolean("requires_invoice").notNull().default(false),
    stage: text("stage").notNull().default("nuevo-lead"),
    stageChangedAt: timestamp("stage_changed_at", { withTimezone: true }).notNull().defaultNow(),
    probability: integer("probability").notNull().default(5),
    expectedCloseOn: date("expected_close_on"),
    responsibleId: text("responsible_id").references(() => users.id, { onDelete: "set null" }),
    sourceId: text("source_id").references(() => leadSources.id, { onDelete: "set null" }),
    campaignId: text("campaign_id").references(() => campaigns.id, { onDelete: "set null" }),
    // Los cinco ciclos de vida, separados.
    proposalStatus: text("proposal_status").$type<ProposalStatus>().notNull().default("sin-propuesta"),
    billingStatus: text("billing_status").$type<BillingStatus>().notNull().default("no-requiere"),
    paymentStatus: text("payment_status").$type<PaymentStatus>().notNull().default("no-vencido"),
    deliveryStatus: text("delivery_status").$type<DeliveryStatus>().notNull().default("pendiente"),
    notes: text("notes"),
    lostReason: text("lost_reason"),
    lastInteractionAt: timestamp("last_interaction_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    isDemo: boolean("is_demo").notNull().default(false),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("opportunities_stage_idx").on(t.stage),
    index("opportunities_contact_idx").on(t.contactId),
    index("opportunities_company_idx").on(t.companyId),
    index("opportunities_responsible_idx").on(t.responsibleId),
    index("opportunities_close_idx").on(t.expectedCloseOn),
  ],
);

export const opportunityProducts = pgTable(
  "opportunity_products",
  {
    id: id(),
    opportunityId: text("opportunity_id")
      .notNull()
      .references(() => opportunities.id, { onDelete: "cascade" }),
    productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
    label: text("label").notNull(),
    quantity: numeric("quantity", { precision: 10, scale: 2 }).notNull().default("1"),
    unitPrice: money("unit_price").notNull().default("0"),
    currency: text("currency").$type<Currency>().notNull().default("COP"),
    createdAt: createdAt(),
  },
  (t) => [index("opportunity_products_opp_idx").on(t.opportunityId)],
);

// ───────────── Timeline unificado: interacciones ─────────────

/**
 * Una sola tabla para todo lo que pasa con un cliente. Los eventos de dominio
 * (propuesta enviada, factura emitida, pago recibido) tambien se escriben aqui
 * para que el timeline sea una consulta y no seis uniones.
 */
export const interactions = pgTable(
  "interactions",
  {
    id: id(),
    kind: text("kind").$type<InteractionKind>().notNull(),
    direction: text("direction").$type<"entrada" | "salida" | "interno">().notNull().default("interno"),
    title: text("title").notNull(),
    body: text("body"),
    amount: money("amount"),
    currency: text("currency").$type<Currency>(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    companyId: text("company_id").references(() => companies.id, { onDelete: "cascade" }),
    opportunityId: text("opportunity_id").references(() => opportunities.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    /** Id del sistema externo (mensaje de WhatsApp, correo de Gmail) para no duplicar. */
    externalId: text("external_id"),
    externalUrl: text("external_url"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("interactions_contact_idx").on(t.contactId, t.occurredAt),
    index("interactions_company_idx").on(t.companyId, t.occurredAt),
    index("interactions_opportunity_idx").on(t.opportunityId, t.occurredAt),
    uniqueIndex("interactions_external_uq").on(t.externalId),
  ],
);

// ───────────────────── Pendientes (tareas) ─────────────────────

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    title: text("title").notNull(),
    kind: text("kind").$type<TaskKind>().notNull().default("otro"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    status: text("status").$type<"abierta" | "hecha" | "cancelada">().notNull().default("abierta"),
    waitingFor: text("waiting_for").$type<WaitingFor>().notNull().default("ninguno"),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    companyId: text("company_id").references(() => companies.id, { onDelete: "cascade" }),
    opportunityId: text("opportunity_id").references(() => opportunities.id, { onDelete: "cascade" }),
    proposalId: text("proposal_id"),
    invoiceId: text("invoice_id"),
    responsibleId: text("responsible_id").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: text("completed_by").references(() => users.id, { onDelete: "set null" }),
    /** Marca las tareas creadas por las reglas automaticas, para no duplicarlas. */
    autoKey: text("auto_key"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("tasks_due_idx").on(t.status, t.dueAt),
    index("tasks_responsible_idx").on(t.responsibleId, t.status),
    index("tasks_opportunity_idx").on(t.opportunityId),
    index("tasks_contact_idx").on(t.contactId),
    uniqueIndex("tasks_auto_key_uq").on(t.autoKey),
  ],
);

// ───────────────────────── Propuestas ─────────────────────────

export const proposals = pgTable(
  "proposals",
  {
    id: id(),
    number: text("number").notNull(),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    companyId: text("company_id").references(() => companies.id, { onDelete: "set null" }),
    opportunityId: text("opportunity_id").references(() => opportunities.id, { onDelete: "cascade" }),
    productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    /** Denormalizados desde la ultima version, para listar sin subconsultas. */
    currentVersion: integer("current_version").notNull().default(1),
    amount: money("amount").notNull().default("0"),
    currency: text("currency").$type<Currency>().notNull().default("COP"),
    status: text("status").$type<ProposalStatus>().notNull().default("borrador"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    expiresOn: date("expires_on"),
    responsibleId: text("responsible_id").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    uniqueIndex("proposals_number_uq").on(t.number),
    index("proposals_status_idx").on(t.status),
    index("proposals_opportunity_idx").on(t.opportunityId),
  ],
);

export const proposalVersions = pgTable(
  "proposal_versions",
  {
    id: id(),
    proposalId: text("proposal_id")
      .notNull()
      .references(() => proposals.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    amount: money("amount").notNull().default("0"),
    currency: text("currency").$type<Currency>().notNull().default("COP"),
    status: text("status").$type<ProposalStatus>().notNull().default("borrador"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    expiresOn: date("expires_on"),
    attachmentId: text("attachment_id"),
    notes: text("notes"),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("proposal_versions_uq").on(t.proposalId, t.version)],
);

// ──────────────────── Facturacion y pagos ────────────────────

export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    number: text("number").notNull(),
    opportunityId: text("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    companyId: text("company_id").references(() => companies.id, { onDelete: "set null" }),
    issueDate: date("issue_date"),
    dueDate: date("due_date"),
    amount: money("amount").notNull().default("0"),
    taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("0"),
    currency: text("currency").$type<Currency>().notNull().default("COP"),
    status: text("status").$type<BillingStatus>().notNull().default("pendiente"),
    attachmentId: text("attachment_id"),
    responsibleId: text("responsible_id").references(() => users.id, { onDelete: "set null" }),
    accountingNotes: text("accounting_notes"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    uniqueIndex("invoices_number_uq").on(t.number),
    index("invoices_status_idx").on(t.status),
    index("invoices_due_idx").on(t.dueDate),
    index("invoices_opportunity_idx").on(t.opportunityId),
  ],
);

/**
 * Un registro por cuota: esperada o recibida. El saldo nunca se guarda, se
 * calcula, para que no exista un estado financiero que contradiga a otro.
 */
export const payments = pgTable(
  "payments",
  {
    id: id(),
    invoiceId: text("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    opportunityId: text("opportunity_id").references(() => opportunities.id, { onDelete: "cascade" }),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    companyId: text("company_id").references(() => companies.id, { onDelete: "set null" }),
    amount: money("amount").notNull().default("0"),
    currency: text("currency").$type<Currency>().notNull().default("COP"),
    expectedOn: date("expected_on"),
    paidOn: date("paid_on"),
    method: text("method"),
    reference: text("reference"),
    status: text("status").$type<PaymentStatus>().notNull().default("pendiente"),
    receiptAttachmentId: text("receipt_attachment_id"),
    notes: text("notes"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("payments_opportunity_idx").on(t.opportunityId),
    index("payments_invoice_idx").on(t.invoiceId),
    index("payments_status_idx").on(t.status),
    index("payments_expected_idx").on(t.expectedOn),
  ],
);

// ───────────────────── Entrega del servicio ─────────────────────

export const serviceDeliveries = pgTable(
  "service_deliveries",
  {
    id: id(),
    title: text("title").notNull(),
    opportunityId: text("opportunity_id").references(() => opportunities.id, { onDelete: "cascade" }),
    productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
    companyId: text("company_id").references(() => companies.id, { onDelete: "set null" }),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    status: text("status").$type<DeliveryStatus>().notNull().default("por-programar"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    location: text("location"),
    isOnline: boolean("is_online").notNull().default(false),
    responsibleId: text("responsible_id").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    isDemo: boolean("is_demo").notNull().default(false),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("service_deliveries_status_idx").on(t.status),
    index("service_deliveries_sched_idx").on(t.scheduledAt),
  ],
);

// ───────────────────── Correo (Gmail / Workspace) ─────────────────────

export const emailAccounts = pgTable(
  "email_accounts",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("gmail"),
    email: text("email").notNull(),
    /** Nunca se guardan contrasenas. Solo tokens OAuth, cifrados en reposo. */
    accessTokenEnc: text("access_token_enc"),
    refreshTokenEnc: text("refresh_token_enc"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    historyId: text("history_id"),
    status: text("status").$type<"conectada" | "error" | "desconectada">().notNull().default("conectada"),
    lastError: text("last_error"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("email_accounts_uq").on(t.userId, t.email)],
);

export const emailThreads = pgTable(
  "email_threads",
  {
    id: id(),
    accountId: text("account_id").references(() => emailAccounts.id, { onDelete: "cascade" }),
    providerThreadId: text("provider_thread_id").notNull(),
    subject: text("subject"),
    snippet: text("snippet"),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    companyId: text("company_id").references(() => companies.id, { onDelete: "set null" }),
    opportunityId: text("opportunity_id").references(() => opportunities.id, { onDelete: "set null" }),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    messageCount: integer("message_count").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("email_threads_uq").on(t.accountId, t.providerThreadId)],
);

export const emailMessages = pgTable(
  "email_messages",
  {
    id: id(),
    threadId: text("thread_id").references(() => emailThreads.id, { onDelete: "cascade" }),
    accountId: text("account_id").references(() => emailAccounts.id, { onDelete: "cascade" }),
    providerMessageId: text("provider_message_id").notNull(),
    fromEmail: text("from_email"),
    fromName: text("from_name"),
    toEmails: text("to_emails"),
    ccEmails: text("cc_emails"),
    subject: text("subject"),
    snippet: text("snippet"),
    bodyText: text("body_text"),
    direction: text("direction").$type<"entrada" | "salida">().notNull().default("entrada"),
    hasAttachments: boolean("has_attachments").notNull().default(false),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    interactionId: text("interaction_id").references(() => interactions.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("email_messages_uq").on(t.accountId, t.providerMessageId)],
);

// ───────────────────────── Documentos ─────────────────────────

export const attachments = pgTable(
  "attachments",
  {
    id: id(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull().default(0),
    /** Ruta en el backend de almacenamiento. Nunca se expone al navegador. */
    storageKey: text("storage_key").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    label: text("label"),
    uploadedBy: text("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    isDemo: boolean("is_demo").notNull().default(false),
    createdAt: createdAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index("attachments_entity_idx").on(t.entityType, t.entityId)],
);

// ───────────────── Auditoria, avisos y ajustes ─────────────────

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    userName: text("user_name"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    summary: text("summary").notNull(),
    changes: jsonb("changes").$type<{ field: string; from: string | null; to: string | null }[]>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_entity_idx").on(t.entityType, t.entityId, t.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt)],
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: updatedAt(),
});

export const importBatches = pgTable("import_batches", {
  id: id(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  filename: text("filename").notNull(),
  entity: text("entity").notNull(),
  imported: integer("imported").notNull().default(0),
  updated: integer("updated").notNull().default(0),
  duplicates: integer("duplicates").notNull().default(0),
  errors: integer("errors").notNull().default(0),
  log: jsonb("log").$type<{ row: number; status: string; detail: string }[]>().notNull().default([]),
  createdAt: createdAt(),
});

// ───────────────────────── Relaciones ─────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  contacts: many(contacts),
  opportunities: many(opportunities),
  tasks: many(tasks),
  emailAccounts: many(emailAccounts),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  responsible: one(users, { fields: [companies.responsibleId], references: [users.id] }),
  source: one(leadSources, { fields: [companies.sourceId], references: [leadSources.id] }),
  contacts: many(contacts),
  opportunities: many(opportunities),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  company: one(companies, { fields: [contacts.companyId], references: [companies.id] }),
  responsible: one(users, { fields: [contacts.responsibleId], references: [users.id] }),
  source: one(leadSources, { fields: [contacts.sourceId], references: [leadSources.id] }),
  campaign: one(campaigns, { fields: [contacts.campaignId], references: [campaigns.id] }),
  interestProduct: one(products, { fields: [contacts.interestProductId], references: [products.id] }),
  opportunities: many(opportunities),
  tags: many(contactTags),
}));

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  contact: one(contacts, { fields: [opportunities.contactId], references: [contacts.id] }),
  company: one(companies, { fields: [opportunities.companyId], references: [companies.id] }),
  product: one(products, { fields: [opportunities.productId], references: [products.id] }),
  responsible: one(users, { fields: [opportunities.responsibleId], references: [users.id] }),
  source: one(leadSources, { fields: [opportunities.sourceId], references: [leadSources.id] }),
  campaign: one(campaigns, { fields: [opportunities.campaignId], references: [campaigns.id] }),
  proposals: many(proposals),
  invoices: many(invoices),
  payments: many(payments),
  tasks: many(tasks),
  deliveries: many(serviceDeliveries),
  lineItems: many(opportunityProducts),
}));

export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  opportunity: one(opportunities, {
    fields: [proposals.opportunityId],
    references: [opportunities.id],
  }),
  contact: one(contacts, { fields: [proposals.contactId], references: [contacts.id] }),
  company: one(companies, { fields: [proposals.companyId], references: [companies.id] }),
  responsible: one(users, { fields: [proposals.responsibleId], references: [users.id] }),
  versions: many(proposalVersions),
}));

export const proposalVersionsRelations = relations(proposalVersions, ({ one }) => ({
  proposal: one(proposals, { fields: [proposalVersions.proposalId], references: [proposals.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  opportunity: one(opportunities, {
    fields: [invoices.opportunityId],
    references: [opportunities.id],
  }),
  contact: one(contacts, { fields: [invoices.contactId], references: [contacts.id] }),
  company: one(companies, { fields: [invoices.companyId], references: [companies.id] }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
  opportunity: one(opportunities, {
    fields: [payments.opportunityId],
    references: [opportunities.id],
  }),
  contact: one(contacts, { fields: [payments.contactId], references: [contacts.id] }),
  company: one(companies, { fields: [payments.companyId], references: [companies.id] }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  contact: one(contacts, { fields: [tasks.contactId], references: [contacts.id] }),
  company: one(companies, { fields: [tasks.companyId], references: [companies.id] }),
  opportunity: one(opportunities, {
    fields: [tasks.opportunityId],
    references: [opportunities.id],
  }),
  responsible: one(users, { fields: [tasks.responsibleId], references: [users.id] }),
}));

export const interactionsRelations = relations(interactions, ({ one }) => ({
  contact: one(contacts, { fields: [interactions.contactId], references: [contacts.id] }),
  company: one(companies, { fields: [interactions.companyId], references: [companies.id] }),
  opportunity: one(opportunities, {
    fields: [interactions.opportunityId],
    references: [opportunities.id],
  }),
  user: one(users, { fields: [interactions.userId], references: [users.id] }),
}));

export const serviceDeliveriesRelations = relations(serviceDeliveries, ({ one }) => ({
  opportunity: one(opportunities, {
    fields: [serviceDeliveries.opportunityId],
    references: [opportunities.id],
  }),
  company: one(companies, { fields: [serviceDeliveries.companyId], references: [companies.id] }),
  contact: one(contacts, { fields: [serviceDeliveries.contactId], references: [contacts.id] }),
  product: one(products, { fields: [serviceDeliveries.productId], references: [products.id] }),
  responsible: one(users, { fields: [serviceDeliveries.responsibleId], references: [users.id] }),
}));

export const contactTagsRelations = relations(contactTags, ({ one }) => ({
  contact: one(contacts, { fields: [contactTags.contactId], references: [contacts.id] }),
  tag: one(tags, { fields: [contactTags.tagId], references: [tags.id] }),
}));

export const emailAccountsRelations = relations(emailAccounts, ({ one, many }) => ({
  user: one(users, { fields: [emailAccounts.userId], references: [users.id] }),
  threads: many(emailThreads),
}));

export const schema = {
  users,
  leadSources,
  campaigns,
  pipelineStages,
  products,
  tags,
  companies,
  contacts,
  companyContacts,
  contactTags,
  opportunities,
  opportunityProducts,
  interactions,
  tasks,
  proposals,
  proposalVersions,
  invoices,
  payments,
  serviceDeliveries,
  emailAccounts,
  emailThreads,
  emailMessages,
  attachments,
  auditLogs,
  notifications,
  settings,
  importBatches,
  usersRelations,
  companiesRelations,
  contactsRelations,
  opportunitiesRelations,
  proposalsRelations,
  proposalVersionsRelations,
  invoicesRelations,
  paymentsRelations,
  tasksRelations,
  interactionsRelations,
  serviceDeliveriesRelations,
  contactTagsRelations,
  emailAccountsRelations,
};

export type User = typeof users.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type Company = typeof companies.$inferSelect;
export type Opportunity = typeof opportunities.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Proposal = typeof proposals.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Interaction = typeof interactions.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ServiceDelivery = typeof serviceDeliveries.$inferSelect;
export type PipelineStage = typeof pipelineStages.$inferSelect;
export type LeadSource = typeof leadSources.$inferSelect;
export type EmailAccount = typeof emailAccounts.$inferSelect;
export type EmailThread = typeof emailThreads.$inferSelect;
export type EmailMessage = typeof emailMessages.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Campaign = typeof campaigns.$inferSelect;
