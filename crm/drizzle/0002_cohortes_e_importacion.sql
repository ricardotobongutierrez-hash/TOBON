CREATE TABLE "cohorts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"product_id" text,
	"product_label" text,
	"city" text,
	"starts_on" date,
	"date_approximate" boolean DEFAULT false NOT NULL,
	"net_price" numeric(16, 2),
	"currency" text DEFAULT 'COP' NOT NULL,
	"counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confirmed_revenue" numeric(16, 2),
	"ceiling_revenue" numeric(16, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "external_key" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "cohort_id" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "external_key" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "import_meta" jsonb;--> statement-breakpoint
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cohorts_starts_idx" ON "cohorts" USING btree ("starts_on");--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_external_key_uq" ON "contacts" USING btree ("external_key");--> statement-breakpoint
CREATE UNIQUE INDEX "opportunities_external_key_uq" ON "opportunities" USING btree ("external_key");--> statement-breakpoint
CREATE INDEX "opportunities_cohort_idx" ON "opportunities" USING btree ("cohort_id");