import "server-only";
import { desc, eq, and } from "drizzle-orm";
import { getDb } from "@/db/client";
import { auditLogs } from "@/db/schema";

/**
 * Bitacora de cambios importantes. Se guarda quien, que y cuando, y se muestra
 * discretamente dentro del registro afectado, no en una pantalla aparte.
 */
export type AuditChange = { field: string; from: string | null; to: string | null };

export async function logAudit(input: {
  userId: string | null;
  userName: string | null;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  changes?: AuditChange[];
}): Promise<void> {
  const db = await getDb();
  await db.insert(auditLogs).values({
    userId: input.userId,
    userName: input.userName,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    summary: input.summary,
    changes: input.changes ?? null,
  });
}

export async function auditFor(entityType: string, entityId: string, limit = 30) {
  const db = await getDb();
  return db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

/** Compara dos versiones de un registro y devuelve solo lo que cambio. */
export function diffRecords<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  labels: Partial<Record<keyof T, string>> = {},
): AuditChange[] {
  const changes: AuditChange[] = [];
  for (const key of Object.keys(after) as (keyof T)[]) {
    const from = before[key];
    const to = after[key];
    if (String(from ?? "") === String(to ?? "")) continue;
    changes.push({
      field: (labels[key] as string) ?? String(key),
      from: from === null || from === undefined ? null : String(from),
      to: to === null || to === undefined ? null : String(to),
    });
  }
  return changes;
}
