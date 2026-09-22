/** Conteo rapido de filas por tabla. Sirve para verificar migraciones y semillas. */
import { sql } from "drizzle-orm";
import { openDb } from "./_db";
import * as s from "../src/db/schema";

import type { PgTable } from "drizzle-orm/pg-core";

const TABLES: [string, PgTable][] = [
  ["users", s.users],
  ["lead_sources", s.leadSources],
  ["campaigns", s.campaigns],
  ["pipeline_stages", s.pipelineStages],
  ["products", s.products],
  ["companies", s.companies],
  ["contacts", s.contacts],
  ["opportunities", s.opportunities],
  ["proposals", s.proposals],
  ["proposal_versions", s.proposalVersions],
  ["invoices", s.invoices],
  ["payments", s.payments],
  ["service_deliveries", s.serviceDeliveries],
  ["tasks", s.tasks],
  ["interactions", s.interactions],
  ["attachments", s.attachments],
  ["audit_logs", s.auditLogs],
  ["email_accounts", s.emailAccounts],
  ["settings", s.settings],
  ["tags", s.tags],
];

async function main() {
  const { db, close } = await openDb();
  for (const [name, table] of TABLES) {
    const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(table);
    console.log(`${name.padEnd(20)} ${row?.n ?? 0}`);
  }
  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
