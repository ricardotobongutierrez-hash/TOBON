import "server-only";
import { aliasedTable, and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  attachments,
  campaigns,
  companies,
  contacts,
  contactTags,
  invoices,
  leadSources,
  opportunities,
  payments,
  products,
  proposals,
  serviceDeliveries,
  tags,
  tasks,
  users,
} from "@/db/schema";
import { getStages } from "@/lib/pipeline";

const responsible = aliasedTable(users, "responsable");

export async function contactDetail(id: string) {
  const db = await getDb();
  const [contact] = await db
    .select({
      c: contacts,
      companyName: companies.name,
      companyIndustry: companies.industry,
      responsibleName: responsible.name,
      sourceName: leadSources.name,
      campaignName: campaigns.name,
      productName: products.name,
    })
    .from(contacts)
    .leftJoin(companies, eq(contacts.companyId, companies.id))
    .leftJoin(responsible, eq(contacts.responsibleId, responsible.id))
    .leftJoin(leadSources, eq(contacts.sourceId, leadSources.id))
    .leftJoin(campaigns, eq(contacts.campaignId, campaigns.id))
    .leftJoin(products, eq(contacts.interestProductId, products.id))
    .where(eq(contacts.id, id))
    .limit(1);

  if (!contact) return null;

  const stages = await getStages();

  const [openTasks, contactTagList, opps, files] = await Promise.all([
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        kind: tasks.kind,
        dueAt: tasks.dueAt,
        waitingFor: tasks.waitingFor,
        responsibleName: responsible.name,
        opportunityId: tasks.opportunityId,
      })
      .from(tasks)
      .leftJoin(responsible, eq(tasks.responsibleId, responsible.id))
      .where(and(eq(tasks.contactId, id), eq(tasks.status, "abierta"), isNull(tasks.deletedAt)))
      .orderBy(sql`${tasks.dueAt} asc nulls last`),
    db
      .select({ name: tags.name })
      .from(contactTags)
      .innerJoin(tags, eq(contactTags.tagId, tags.id))
      .where(eq(contactTags.contactId, id)),
    db
      .select({
        id: opportunities.id,
        name: opportunities.name,
        amount: opportunities.amount,
        currency: opportunities.currency,
        stage: opportunities.stage,
        probability: opportunities.probability,
        expectedCloseOn: opportunities.expectedCloseOn,
        proposalStatus: opportunities.proposalStatus,
        billingStatus: opportunities.billingStatus,
        paymentStatus: opportunities.paymentStatus,
        deliveryStatus: opportunities.deliveryStatus,
        closedAt: opportunities.closedAt,
      })
      .from(opportunities)
      .where(and(eq(opportunities.contactId, id), isNull(opportunities.deletedAt)))
      .orderBy(desc(opportunities.createdAt)),
    db
      .select()
      .from(attachments)
      .where(and(eq(attachments.entityType, "contacto"), eq(attachments.entityId, id), isNull(attachments.deletedAt)))
      .orderBy(desc(attachments.createdAt)),
  ]);

  return {
    ...contact.c,
    companyName: contact.companyName,
    companyIndustry: contact.companyIndustry,
    responsibleName: contact.responsibleName,
    sourceName: contact.sourceName,
    campaignName: contact.campaignName,
    productName: contact.productName,
    openTasks,
    tags: contactTagList.map((t) => t.name),
    opportunities: opps,
    attachments: files,
    stages,
  };
}

export async function companyDetail(id: string) {
  const db = await getDb();
  const [company] = await db
    .select({
      c: companies,
      responsibleName: responsible.name,
      sourceName: leadSources.name,
    })
    .from(companies)
    .leftJoin(responsible, eq(companies.responsibleId, responsible.id))
    .leftJoin(leadSources, eq(companies.sourceId, leadSources.id))
    .where(eq(companies.id, id))
    .limit(1);

  if (!company) return null;

  const stages = await getStages();

  const [companyContactList, opps, proposalList, invoiceList, paymentList, deliveryList, openTasks, files] =
    await Promise.all([
      db
        .select({
          id: contacts.id,
          fullName: contacts.fullName,
          position: contacts.position,
          email: contacts.email,
          phone: contacts.phone,
          status: contacts.status,
          leadScore: contacts.leadScore,
          leadScoreManual: contacts.leadScoreManual,
          leadScoreBreakdown: contacts.leadScoreBreakdown,
          lastInteractionAt: contacts.lastInteractionAt,
        })
        .from(contacts)
        .where(and(eq(contacts.companyId, id), isNull(contacts.deletedAt)))
        .orderBy(asc(contacts.fullName)),
      db
        .select({
          id: opportunities.id,
          name: opportunities.name,
          amount: opportunities.amount,
          currency: opportunities.currency,
          stage: opportunities.stage,
          probability: opportunities.probability,
          expectedCloseOn: opportunities.expectedCloseOn,
          proposalStatus: opportunities.proposalStatus,
          billingStatus: opportunities.billingStatus,
          paymentStatus: opportunities.paymentStatus,
          deliveryStatus: opportunities.deliveryStatus,
          closedAt: opportunities.closedAt,
          lostReason: opportunities.lostReason,
        })
        .from(opportunities)
        .where(and(eq(opportunities.companyId, id), isNull(opportunities.deletedAt)))
        .orderBy(desc(opportunities.amount)),
      db
        .select()
        .from(proposals)
        .where(and(eq(proposals.companyId, id), isNull(proposals.deletedAt)))
        .orderBy(desc(proposals.createdAt)),
      db
        .select()
        .from(invoices)
        .where(and(eq(invoices.companyId, id), isNull(invoices.deletedAt)))
        .orderBy(desc(invoices.issueDate)),
      db
        .select()
        .from(payments)
        .where(and(eq(payments.companyId, id), isNull(payments.deletedAt)))
        .orderBy(desc(payments.expectedOn)),
      db
        .select()
        .from(serviceDeliveries)
        .where(and(eq(serviceDeliveries.companyId, id), isNull(serviceDeliveries.deletedAt)))
        .orderBy(asc(serviceDeliveries.scheduledAt)),
      db
        .select({
          id: tasks.id,
          title: tasks.title,
          kind: tasks.kind,
          dueAt: tasks.dueAt,
          waitingFor: tasks.waitingFor,
          responsibleName: responsible.name,
          contactId: tasks.contactId,
          opportunityId: tasks.opportunityId,
        })
        .from(tasks)
        .leftJoin(responsible, eq(tasks.responsibleId, responsible.id))
        .where(and(eq(tasks.companyId, id), eq(tasks.status, "abierta"), isNull(tasks.deletedAt)))
        .orderBy(sql`${tasks.dueAt} asc nulls last`),
      db
        .select()
        .from(attachments)
        .where(and(eq(attachments.entityType, "empresa"), eq(attachments.entityId, id), isNull(attachments.deletedAt)))
        .orderBy(desc(attachments.createdAt)),
    ]);

  return {
    ...company.c,
    responsibleName: company.responsibleName,
    sourceName: company.sourceName,
    contacts: companyContactList,
    opportunities: opps,
    proposals: proposalList,
    invoices: invoiceList,
    payments: paymentList,
    deliveries: deliveryList,
    openTasks,
    attachments: files,
    stages,
  };
}

export async function opportunityDetail(id: string) {
  const db = await getDb();
  const [opp] = await db
    .select({
      o: opportunities,
      contactName: contacts.fullName,
      contactEmail: contacts.email,
      contactPhone: contacts.phone,
      contactPosition: contacts.position,
      companyName: companies.name,
      productName: products.name,
      responsibleName: responsible.name,
      sourceName: leadSources.name,
      campaignName: campaigns.name,
    })
    .from(opportunities)
    .leftJoin(contacts, eq(opportunities.contactId, contacts.id))
    .leftJoin(companies, eq(opportunities.companyId, companies.id))
    .leftJoin(products, eq(opportunities.productId, products.id))
    .leftJoin(responsible, eq(opportunities.responsibleId, responsible.id))
    .leftJoin(leadSources, eq(opportunities.sourceId, leadSources.id))
    .leftJoin(campaigns, eq(opportunities.campaignId, campaigns.id))
    .where(eq(opportunities.id, id))
    .limit(1);

  if (!opp) return null;

  const stages = await getStages();

  const [proposalList, invoiceList, paymentList, deliveryList, openTasks, files] = await Promise.all([
    db
      .select()
      .from(proposals)
      .where(and(eq(proposals.opportunityId, id), isNull(proposals.deletedAt)))
      .orderBy(desc(proposals.createdAt)),
    db
      .select()
      .from(invoices)
      .where(and(eq(invoices.opportunityId, id), isNull(invoices.deletedAt)))
      .orderBy(desc(invoices.issueDate)),
    db
      .select()
      .from(payments)
      .where(and(eq(payments.opportunityId, id), isNull(payments.deletedAt)))
      .orderBy(sql`${payments.expectedOn} asc nulls last`),
    db
      .select()
      .from(serviceDeliveries)
      .where(and(eq(serviceDeliveries.opportunityId, id), isNull(serviceDeliveries.deletedAt)))
      .orderBy(asc(serviceDeliveries.scheduledAt)),
    db
      .select({
        id: tasks.id,
        title: tasks.title,
        kind: tasks.kind,
        dueAt: tasks.dueAt,
        waitingFor: tasks.waitingFor,
        notes: tasks.notes,
        responsibleName: responsible.name,
      })
      .from(tasks)
      .leftJoin(responsible, eq(tasks.responsibleId, responsible.id))
      .where(and(eq(tasks.opportunityId, id), eq(tasks.status, "abierta"), isNull(tasks.deletedAt)))
      .orderBy(sql`${tasks.dueAt} asc nulls last`),
    db
      .select()
      .from(attachments)
      .where(and(eq(attachments.entityType, "negocio"), eq(attachments.entityId, id), isNull(attachments.deletedAt)))
      .orderBy(desc(attachments.createdAt)),
  ]);

  return {
    ...opp.o,
    contactName: opp.contactName,
    contactEmail: opp.contactEmail,
    contactPhone: opp.contactPhone,
    contactPosition: opp.contactPosition,
    companyName: opp.companyName,
    productName: opp.productName,
    responsibleName: opp.responsibleName,
    sourceName: opp.sourceName,
    campaignName: opp.campaignName,
    proposals: proposalList,
    invoices: invoiceList,
    payments: paymentList,
    deliveries: deliveryList,
    openTasks,
    attachments: files,
    stages,
  };
}

export type ContactDetail = NonNullable<Awaited<ReturnType<typeof contactDetail>>>;
export type CompanyDetail = NonNullable<Awaited<ReturnType<typeof companyDetail>>>;
export type OpportunityDetail = NonNullable<Awaited<ReturnType<typeof opportunityDetail>>>;
