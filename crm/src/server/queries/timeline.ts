import "server-only";
import { desc, eq, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { interactions, users } from "@/db/schema";

/**
 * El timeline unificado. Una sola consulta ordenada por fecha: WhatsApp, correos,
 * llamadas, reuniones, notas, propuestas, facturas, pagos y cambios de estado.
 */
export type TimelineEntry = {
  id: string;
  kind: string;
  direction: string;
  title: string;
  body: string | null;
  amount: string | null;
  currency: string | null;
  occurredAt: Date;
  externalUrl: string | null;
  userName: string | null;
};

export async function timelineFor(
  scope: { contactId?: string; companyId?: string; opportunityId?: string },
  limit = 80,
): Promise<TimelineEntry[]> {
  const db = await getDb();
  const clauses = [];
  if (scope.contactId) clauses.push(eq(interactions.contactId, scope.contactId));
  if (scope.companyId) clauses.push(eq(interactions.companyId, scope.companyId));
  if (scope.opportunityId) clauses.push(eq(interactions.opportunityId, scope.opportunityId));
  if (clauses.length === 0) return [];

  return db
    .select({
      id: interactions.id,
      kind: interactions.kind,
      direction: interactions.direction,
      title: interactions.title,
      body: interactions.body,
      amount: interactions.amount,
      currency: interactions.currency,
      occurredAt: interactions.occurredAt,
      externalUrl: interactions.externalUrl,
      userName: users.name,
    })
    .from(interactions)
    .leftJoin(users, eq(interactions.userId, users.id))
    .where(clauses.length === 1 ? clauses[0] : or(...clauses))
    .orderBy(desc(interactions.occurredAt), desc(interactions.createdAt))
    .limit(limit);
}
