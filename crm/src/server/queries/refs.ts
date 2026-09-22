import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { campaigns, companies, contacts, leadSources, products, tags, users } from "@/db/schema";
import { getStages } from "@/lib/pipeline";

/**
 * Datos de referencia para los formularios. Se cargan juntos porque casi todos
 * los paneles de creacion necesitan lo mismo, y asi el panel abre con una sola
 * consulta en vez de cinco.
 */
export type Refs = Awaited<ReturnType<typeof loadRefs>>;

export async function loadRefs() {
  const db = await getDb();
  const [team, sources, campaignList, productList, stages, tagList] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role })
      .from(users)
      .where(and(isNull(users.deletedAt), eq(users.active, true)))
      .orderBy(asc(users.name)),
    db
      .select({ id: leadSources.id, name: leadSources.name })
      .from(leadSources)
      .where(eq(leadSources.active, true))
      .orderBy(asc(leadSources.sort), asc(leadSources.name)),
    db
      .select({ id: campaigns.id, name: campaigns.name, sourceId: campaigns.sourceId })
      .from(campaigns)
      .where(eq(campaigns.active, true))
      .orderBy(asc(campaigns.name)),
    db
      .select({
        id: products.id,
        name: products.name,
        category: products.category,
        defaultPrice: products.defaultPrice,
        promoPrice: products.promoPrice,
        currency: products.currency,
        taxable: products.taxable,
      })
      .from(products)
      .where(and(isNull(products.deletedAt), eq(products.active, true)))
      .orderBy(asc(products.sort), asc(products.name)),
    getStages(),
    db.select({ id: tags.id, name: tags.name }).from(tags).orderBy(asc(tags.name)),
  ]);

  return { team, sources, campaigns: campaignList, products: productList, stages, tags: tagList };
}

/** Listas livianas de contactos y empresas, para los selectores. */
export async function loadPickers() {
  const db = await getDb();
  const [contactList, companyList] = await Promise.all([
    db
      .select({
        id: contacts.id,
        fullName: contacts.fullName,
        companyId: contacts.companyId,
        email: contacts.email,
      })
      .from(contacts)
      .where(isNull(contacts.deletedAt))
      .orderBy(asc(contacts.fullName))
      .limit(2000),
    db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(isNull(companies.deletedAt))
      .orderBy(asc(companies.name))
      .limit(2000),
  ]);
  return { contacts: contactList, companies: companyList };
}

export type Pickers = Awaited<ReturnType<typeof loadPickers>>;
