import "server-only";
import { aliasedTable, and, asc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { companies, contacts, opportunities, products, serviceDeliveries, users } from "@/db/schema";

const responsible = aliasedTable(users, "responsable");

/**
 * Lo que ya se vendió y falta entregar. Responde de una sola mirada la pregunta
 * que antes obligaba a abrir negocio por negocio: qué servicio queda pendiente.
 */
export async function pendingDeliveries(options: { responsibleId?: string | null } = {}) {
  const db = await getDb();
  const where = [
    isNull(serviceDeliveries.deletedAt),
    ne(serviceDeliveries.status, "completado"),
    ne(serviceDeliveries.status, "cancelado"),
  ];
  if (options.responsibleId) where.push(eq(serviceDeliveries.responsibleId, options.responsibleId));

  return db
    .select({
      id: serviceDeliveries.id,
      title: serviceDeliveries.title,
      status: serviceDeliveries.status,
      scheduledAt: serviceDeliveries.scheduledAt,
      location: serviceDeliveries.location,
      isOnline: serviceDeliveries.isOnline,
      notes: serviceDeliveries.notes,
      opportunityId: serviceDeliveries.opportunityId,
      opportunityAmount: opportunities.amount,
      opportunityCurrency: opportunities.currency,
      paymentStatus: opportunities.paymentStatus,
      companyId: serviceDeliveries.companyId,
      companyName: companies.name,
      contactId: serviceDeliveries.contactId,
      contactName: contacts.fullName,
      productName: products.name,
      responsibleName: responsible.name,
    })
    .from(serviceDeliveries)
    .leftJoin(opportunities, eq(serviceDeliveries.opportunityId, opportunities.id))
    .leftJoin(companies, eq(serviceDeliveries.companyId, companies.id))
    .leftJoin(contacts, eq(serviceDeliveries.contactId, contacts.id))
    .leftJoin(products, eq(serviceDeliveries.productId, products.id))
    .leftJoin(responsible, eq(serviceDeliveries.responsibleId, responsible.id))
    .where(and(...where))
    // Lo que ya tiene fecha va primero, y lo que no la tiene queda al final,
    // que es justamente lo que hay que coordinar.
    .orderBy(sql`${serviceDeliveries.scheduledAt} asc nulls last`)
    .limit(100);
}

export type PendingDelivery = Awaited<ReturnType<typeof pendingDeliveries>>[number];
