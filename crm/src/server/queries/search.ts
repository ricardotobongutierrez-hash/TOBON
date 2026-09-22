import "server-only";
import { and, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { companies, contacts, invoices, opportunities, proposals } from "@/db/schema";

/**
 * Busqueda universal: contactos, empresas, negocios, propuestas y facturas en
 * una sola consulta. Se escribe "Dorex", "Juan Pérez" o "Bootcamp" y aparece.
 */
export type SearchHit = {
  id: string;
  kind: "contacto" | "empresa" | "negocio" | "propuesta" | "factura";
  title: string;
  subtitle: string;
  href: string;
  meta: string | null;
};

const KIND_LABEL: Record<SearchHit["kind"], string> = {
  contacto: "Contacto",
  empresa: "Empresa",
  negocio: "Negocio",
  propuesta: "Propuesta",
  factura: "Factura",
};

export async function globalSearch(query: string, limitPerKind = 5): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;
  const db = await getDb();

  const [contactRows, companyRows, oppRows, proposalRows, invoiceRows] = await Promise.all([
    db
      .select({
        id: contacts.id,
        fullName: contacts.fullName,
        email: contacts.email,
        position: contacts.position,
        companyName: companies.name,
      })
      .from(contacts)
      .leftJoin(companies, eq(contacts.companyId, companies.id))
      .where(
        and(
          isNull(contacts.deletedAt),
          or(
            ilike(contacts.fullName, like),
            ilike(contacts.email, like),
            ilike(contacts.phone, like),
            ilike(contacts.phoneNormalized, like),
          ),
        ),
      )
      .limit(limitPerKind),
    db
      .select({
        id: companies.id,
        name: companies.name,
        industry: companies.industry,
        city: companies.city,
        website: companies.website,
      })
      .from(companies)
      .where(
        and(
          isNull(companies.deletedAt),
          or(ilike(companies.name, like), ilike(companies.website, like), ilike(companies.industry, like)),
        ),
      )
      .limit(limitPerKind),
    db
      .select({
        id: opportunities.id,
        name: opportunities.name,
        amount: opportunities.amount,
        currency: opportunities.currency,
        stage: opportunities.stage,
        companyName: companies.name,
        contactName: contacts.fullName,
      })
      .from(opportunities)
      .leftJoin(companies, eq(opportunities.companyId, companies.id))
      .leftJoin(contacts, eq(opportunities.contactId, contacts.id))
      .where(
        and(
          isNull(opportunities.deletedAt),
          or(ilike(opportunities.name, like), ilike(companies.name, like), ilike(contacts.fullName, like)),
        ),
      )
      .limit(limitPerKind),
    db
      .select({
        id: proposals.id,
        number: proposals.number,
        title: proposals.title,
        status: proposals.status,
        opportunityId: proposals.opportunityId,
        companyName: companies.name,
        contactName: contacts.fullName,
      })
      .from(proposals)
      .leftJoin(companies, eq(proposals.companyId, companies.id))
      .leftJoin(contacts, eq(proposals.contactId, contacts.id))
      .where(
        and(
          isNull(proposals.deletedAt),
          or(
            ilike(proposals.number, like),
            ilike(proposals.title, like),
            ilike(companies.name, like),
            ilike(contacts.fullName, like),
          ),
        ),
      )
      .limit(limitPerKind),
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        amount: invoices.amount,
        currency: invoices.currency,
        status: invoices.status,
        opportunityId: invoices.opportunityId,
        companyName: companies.name,
        contactName: contacts.fullName,
      })
      .from(invoices)
      .leftJoin(companies, eq(invoices.companyId, companies.id))
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(
        and(
          isNull(invoices.deletedAt),
          or(ilike(invoices.number, like), ilike(companies.name, like), ilike(contacts.fullName, like)),
        ),
      )
      .limit(limitPerKind),
  ]);

  const hits: SearchHit[] = [];

  for (const r of contactRows) {
    hits.push({
      id: r.id,
      kind: "contacto",
      title: r.fullName,
      subtitle: [r.position, r.companyName].filter(Boolean).join(" · ") || r.email || "Contacto",
      href: `/contactos/${r.id}`,
      meta: null,
    });
  }
  for (const r of companyRows) {
    hits.push({
      id: r.id,
      kind: "empresa",
      title: r.name,
      subtitle: [r.industry, r.city].filter(Boolean).join(" · ") || "Empresa",
      href: `/empresas/${r.id}`,
      meta: null,
    });
  }
  for (const r of oppRows) {
    hits.push({
      id: r.id,
      kind: "negocio",
      title: r.name,
      subtitle: r.companyName ?? r.contactName ?? "Negocio",
      href: `/negocios/${r.id}`,
      meta: `${r.currency} ${Number(r.amount).toLocaleString("es-CO", { maximumFractionDigits: 0 })}`,
    });
  }
  for (const r of proposalRows) {
    hits.push({
      id: r.id,
      kind: "propuesta",
      title: `${r.number} · ${r.title}`,
      subtitle: r.companyName ?? r.contactName ?? "Propuesta",
      href: r.opportunityId ? `/negocios/${r.opportunityId}` : "/negocios",
      meta: r.status,
    });
  }
  for (const r of invoiceRows) {
    hits.push({
      id: r.id,
      kind: "factura",
      title: `Factura ${r.number}`,
      subtitle: r.companyName ?? r.contactName ?? "Factura",
      href: r.opportunityId ? `/negocios/${r.opportunityId}` : "/finanzas",
      meta: `${r.currency} ${Number(r.amount).toLocaleString("es-CO", { maximumFractionDigits: 0 })}`,
    });
  }

  return hits;
}

export { KIND_LABEL };
