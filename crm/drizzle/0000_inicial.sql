CREATE TABLE "attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer DEFAULT 0 NOT NULL,
	"storage_key" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"label" text,
	"uploaded_by" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"user_name" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"summary" text NOT NULL,
	"changes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"source_id" text,
	"channel" text,
	"starts_on" date,
	"ends_on" date,
	"budget" numeric(16, 2),
	"currency" text DEFAULT 'COP' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"domain" text,
	"industry" text,
	"country" text,
	"city" text,
	"size" text,
	"responsible_id" text,
	"source_id" text,
	"campaign_id" text,
	"purchasing_capacity" text DEFAULT 'sin-definir' NOT NULL,
	"notes" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "company_contacts" (
	"company_id" text NOT NULL,
	"contact_id" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"role" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "company_contacts_company_id_contact_id_pk" PRIMARY KEY("company_id","contact_id")
);
--> statement-breakpoint
CREATE TABLE "contact_tags" (
	"contact_id" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "contact_tags_contact_id_tag_id_pk" PRIMARY KEY("contact_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"phone_normalized" text,
	"email" text,
	"email_normalized" text,
	"company_id" text,
	"position" text,
	"city" text,
	"country" text,
	"segment" text DEFAULT 'b2c' NOT NULL,
	"source_id" text,
	"campaign_id" text,
	"first_touch_source_id" text,
	"last_touch_source_id" text,
	"interest_product_id" text,
	"responsible_id" text,
	"status" text DEFAULT 'nuevo' NOT NULL,
	"lead_score" integer DEFAULT 0 NOT NULL,
	"lead_score_manual" integer,
	"lead_score_breakdown" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"last_interaction_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "email_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text DEFAULT 'gmail' NOT NULL,
	"email" text NOT NULL,
	"access_token_enc" text,
	"refresh_token_enc" text,
	"token_expires_at" timestamp with time zone,
	"scope" text,
	"history_id" text,
	"status" text DEFAULT 'conectada' NOT NULL,
	"last_error" text,
	"last_sync_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text,
	"account_id" text,
	"provider_message_id" text NOT NULL,
	"from_email" text,
	"from_name" text,
	"to_emails" text,
	"cc_emails" text,
	"subject" text,
	"snippet" text,
	"body_text" text,
	"direction" text DEFAULT 'entrada' NOT NULL,
	"has_attachments" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp with time zone,
	"contact_id" text,
	"interaction_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text,
	"provider_thread_id" text NOT NULL,
	"subject" text,
	"snippet" text,
	"contact_id" text,
	"company_id" text,
	"opportunity_id" text,
	"last_message_at" timestamp with time zone,
	"message_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"filename" text NOT NULL,
	"entity" text NOT NULL,
	"imported" integer DEFAULT 0 NOT NULL,
	"updated" integer DEFAULT 0 NOT NULL,
	"duplicates" integer DEFAULT 0 NOT NULL,
	"errors" integer DEFAULT 0 NOT NULL,
	"log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"direction" text DEFAULT 'interno' NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"amount" numeric(16, 2),
	"currency" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"contact_id" text,
	"company_id" text,
	"opportunity_id" text,
	"user_id" text,
	"external_id" text,
	"external_url" text,
	"meta" jsonb,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"opportunity_id" text,
	"contact_id" text,
	"company_id" text,
	"issue_date" date,
	"due_date" date,
	"amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'COP' NOT NULL,
	"status" text DEFAULT 'pendiente' NOT NULL,
	"attachment_id" text,
	"responsible_id" text,
	"accounting_notes" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "lead_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_id" text,
	"company_id" text,
	"segment" text DEFAULT 'b2b' NOT NULL,
	"product_id" text,
	"amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'COP' NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '0' NOT NULL,
	"requires_invoice" boolean DEFAULT false NOT NULL,
	"stage" text DEFAULT 'nuevo-lead' NOT NULL,
	"stage_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"probability" integer DEFAULT 5 NOT NULL,
	"expected_close_on" date,
	"responsible_id" text,
	"source_id" text,
	"campaign_id" text,
	"proposal_status" text DEFAULT 'sin-propuesta' NOT NULL,
	"billing_status" text DEFAULT 'no-requiere' NOT NULL,
	"payment_status" text DEFAULT 'no-vencido' NOT NULL,
	"delivery_status" text DEFAULT 'pendiente' NOT NULL,
	"notes" text,
	"lost_reason" text,
	"last_interaction_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "opportunity_products" (
	"id" text PRIMARY KEY NOT NULL,
	"opportunity_id" text NOT NULL,
	"product_id" text,
	"label" text NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '1' NOT NULL,
	"unit_price" numeric(16, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'COP' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text,
	"opportunity_id" text,
	"contact_id" text,
	"company_id" text,
	"amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'COP' NOT NULL,
	"expected_on" date,
	"paid_on" date,
	"method" text,
	"reference" text,
	"status" text DEFAULT 'pendiente' NOT NULL,
	"receipt_attachment_id" text,
	"notes" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "pipeline_stages" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'activa' NOT NULL,
	"probability" integer DEFAULT 0 NOT NULL,
	"sort" integer DEFAULT 100 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'otro' NOT NULL,
	"audience" text DEFAULT 'ambos' NOT NULL,
	"description" text,
	"default_price" numeric(16, 2),
	"currency" text DEFAULT 'COP' NOT NULL,
	"unit" text,
	"taxable" boolean DEFAULT true NOT NULL,
	"promo_price" numeric(16, 2),
	"promo_label" text,
	"promo_ends_on" date,
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "proposal_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"proposal_id" text NOT NULL,
	"version" integer NOT NULL,
	"amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'COP' NOT NULL,
	"status" text DEFAULT 'borrador' NOT NULL,
	"sent_at" timestamp with time zone,
	"expires_on" date,
	"attachment_id" text,
	"notes" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" text PRIMARY KEY NOT NULL,
	"number" text NOT NULL,
	"contact_id" text,
	"company_id" text,
	"opportunity_id" text,
	"product_id" text,
	"title" text NOT NULL,
	"current_version" integer DEFAULT 1 NOT NULL,
	"amount" numeric(16, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'COP' NOT NULL,
	"status" text DEFAULT 'borrador' NOT NULL,
	"sent_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"expires_on" date,
	"responsible_id" text,
	"notes" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "service_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"opportunity_id" text,
	"product_id" text,
	"company_id" text,
	"contact_id" text,
	"status" text DEFAULT 'por-programar' NOT NULL,
	"scheduled_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"location" text,
	"is_online" boolean DEFAULT false NOT NULL,
	"responsible_id" text,
	"notes" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tags" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT 'mariner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'otro' NOT NULL,
	"due_at" timestamp with time zone,
	"status" text DEFAULT 'abierta' NOT NULL,
	"waiting_for" text DEFAULT 'ninguno' NOT NULL,
	"contact_id" text,
	"company_id" text,
	"opportunity_id" text,
	"proposal_id" text,
	"invoice_id" text,
	"responsible_id" text,
	"notes" text,
	"completed_at" timestamp with time zone,
	"completed_by" text,
	"auto_key" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'equipo' NOT NULL,
	"photo_url" text,
	"phone" text,
	"active" boolean DEFAULT true NOT NULL,
	"notify_prefs" jsonb DEFAULT '{"resumenDiario":true,"vencidos":true,"pagos":true}'::jsonb NOT NULL,
	"last_login_at" timestamp with time zone,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_source_id_lead_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."lead_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_responsible_id_users_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_source_id_lead_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."lead_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_contacts" ADD CONSTRAINT "company_contacts_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_source_id_lead_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."lead_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_first_touch_source_id_lead_sources_id_fk" FOREIGN KEY ("first_touch_source_id") REFERENCES "public"."lead_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_last_touch_source_id_lead_sources_id_fk" FOREIGN KEY ("last_touch_source_id") REFERENCES "public"."lead_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_interest_product_id_products_id_fk" FOREIGN KEY ("interest_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_responsible_id_users_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_thread_id_email_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."email_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_account_id_email_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."email_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_interaction_id_interactions_id_fk" FOREIGN KEY ("interaction_id") REFERENCES "public"."interactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_account_id_email_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."email_accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_threads" ADD CONSTRAINT "email_threads_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_responsible_id_users_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_responsible_id_users_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_source_id_lead_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."lead_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_products" ADD CONSTRAINT "opportunity_products_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_products" ADD CONSTRAINT "opportunity_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_responsible_id_users_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_deliveries" ADD CONSTRAINT "service_deliveries_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_deliveries" ADD CONSTRAINT "service_deliveries_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_deliveries" ADD CONSTRAINT "service_deliveries_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_deliveries" ADD CONSTRAINT "service_deliveries_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_deliveries" ADD CONSTRAINT "service_deliveries_responsible_id_users_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_deliveries" ADD CONSTRAINT "service_deliveries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_responsible_id_users_id_fk" FOREIGN KEY ("responsible_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attachments_entity_idx" ON "attachments" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "campaigns_source_idx" ON "campaigns" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "companies_name_idx" ON "companies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "companies_domain_idx" ON "companies" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "companies_responsible_idx" ON "companies" USING btree ("responsible_id");--> statement-breakpoint
CREATE INDEX "contacts_name_idx" ON "contacts" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "contacts_email_idx" ON "contacts" USING btree ("email_normalized");--> statement-breakpoint
CREATE INDEX "contacts_phone_idx" ON "contacts" USING btree ("phone_normalized");--> statement-breakpoint
CREATE INDEX "contacts_company_idx" ON "contacts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "contacts_responsible_idx" ON "contacts" USING btree ("responsible_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_accounts_uq" ON "email_accounts" USING btree ("user_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "email_messages_uq" ON "email_messages" USING btree ("account_id","provider_message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "email_threads_uq" ON "email_threads" USING btree ("account_id","provider_thread_id");--> statement-breakpoint
CREATE INDEX "interactions_contact_idx" ON "interactions" USING btree ("contact_id","occurred_at");--> statement-breakpoint
CREATE INDEX "interactions_company_idx" ON "interactions" USING btree ("company_id","occurred_at");--> statement-breakpoint
CREATE INDEX "interactions_opportunity_idx" ON "interactions" USING btree ("opportunity_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "interactions_external_uq" ON "interactions" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_uq" ON "invoices" USING btree ("number");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoices_due_idx" ON "invoices" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX "invoices_opportunity_idx" ON "invoices" USING btree ("opportunity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_sources_slug_uq" ON "lead_sources" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "opportunities_stage_idx" ON "opportunities" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "opportunities_contact_idx" ON "opportunities" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "opportunities_company_idx" ON "opportunities" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "opportunities_responsible_idx" ON "opportunities" USING btree ("responsible_id");--> statement-breakpoint
CREATE INDEX "opportunities_close_idx" ON "opportunities" USING btree ("expected_close_on");--> statement-breakpoint
CREATE INDEX "opportunity_products_opp_idx" ON "opportunity_products" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "payments_opportunity_idx" ON "payments" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "payments_invoice_idx" ON "payments" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_expected_idx" ON "payments" USING btree ("expected_on");--> statement-breakpoint
CREATE UNIQUE INDEX "pipeline_stages_slug_uq" ON "pipeline_stages" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category");--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_versions_uq" ON "proposal_versions" USING btree ("proposal_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "proposals_number_uq" ON "proposals" USING btree ("number");--> statement-breakpoint
CREATE INDEX "proposals_status_idx" ON "proposals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "proposals_opportunity_idx" ON "proposals" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "service_deliveries_status_idx" ON "service_deliveries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "service_deliveries_sched_idx" ON "service_deliveries" USING btree ("scheduled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_name_uq" ON "tags" USING btree ("name");--> statement-breakpoint
CREATE INDEX "tasks_due_idx" ON "tasks" USING btree ("status","due_at");--> statement-breakpoint
CREATE INDEX "tasks_responsible_idx" ON "tasks" USING btree ("responsible_id","status");--> statement-breakpoint
CREATE INDEX "tasks_opportunity_idx" ON "tasks" USING btree ("opportunity_id");--> statement-breakpoint
CREATE INDEX "tasks_contact_idx" ON "tasks" USING btree ("contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_auto_key_uq" ON "tasks" USING btree ("auto_key");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");