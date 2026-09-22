import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { companies, contacts, interactions, opportunities } from "@/db/schema";
import type { Currency, InteractionKind } from "@/db/enums";

/**
 * Un evento del timeline. Toda accion del CRM que un cliente notaria pasa por
 * aqui: asi el timeline unificado es una sola consulta ordenada por fecha y no
 * seis uniones que se desincronizan.
 *
 * Tambien actualiza "última interacción" en el contacto, la empresa y el negocio,
 * que es lo que alimenta las alertas de silencio.
 */
export async function logEvent(input: {
  kind: InteractionKind;
  direction?: "entrada" | "salida" | "interno";
  title: string;
  body?: string | null;
  amount?: string | number | null;
  currency?: Currency | null;
  occurredAt?: Date;
  contactId?: string | null;
  companyId?: string | null;
  opportunityId?: string | null;
  userId?: string | null;
  externalId?: string | null;
  externalUrl?: string | null;
  meta?: Record<string, unknown>;
  isDemo?: boolean;
  /** Las interacciones reales cuentan como contacto; los cambios de estado no. */
  touch?: boolean;
}): Promise<string | null> {
  const db = await getDb();
  const occurredAt = input.occurredAt ?? new Date();

  const [row] = await db
    .insert(interactions)
    .values({
      kind: input.kind,
      direction: input.direction ?? "interno",
      title: input.title,
      body: input.body ?? null,
      amount: input.amount === null || input.amount === undefined ? null : String(input.amount),
      currency: input.currency ?? null,
      occurredAt,
      contactId: input.contactId ?? null,
      companyId: input.companyId ?? null,
      opportunityId: input.opportunityId ?? null,
      userId: input.userId ?? null,
      externalId: input.externalId ?? null,
      externalUrl: input.externalUrl ?? null,
      meta: input.meta ?? null,
      isDemo: input.isDemo ?? false,
    })
    // Con externalId repetido (reentrega de un webhook) no se duplica el evento.
    .onConflictDoNothing()
    .returning({ id: interactions.id });

  const touch = input.touch ?? ["whatsapp", "email", "llamada", "reunion"].includes(input.kind);
  if (touch) {
    if (input.contactId) {
      await db
        .update(contacts)
        .set({ lastInteractionAt: occurredAt })
        .where(eq(contacts.id, input.contactId));
    }
    if (input.opportunityId) {
      await db
        .update(opportunities)
        .set({ lastInteractionAt: occurredAt })
        .where(eq(opportunities.id, input.opportunityId));
    }
    if (input.companyId) {
      await db
        .update(companies)
        .set({ updatedAt: sql`greatest(${companies.updatedAt}, ${occurredAt})` })
        .where(eq(companies.id, input.companyId));
    }
  }

  return row?.id ?? null;
}
