import "server-only";
import { and, eq, isNull, or } from "drizzle-orm";
import { getDb } from "@/db/client";
import { campaigns, companies, contacts, leadSources, opportunities, products, tasks, users } from "@/db/schema";
import { logEvent } from "./events";
import { ensureTask, recalcLeadScore } from "./automation";
import { getStages } from "./pipeline";
import { followUpSettings } from "./settings";
import {
  companyKey,
  corporateDomain,
  normalizeEmail,
  normalizeName,
  normalizePhone,
} from "./normalize";
import { foldCase } from "./utils";
import { toMoneyString, parseMoneyInput } from "./money";
import { addDays, toDate } from "./dates";

/**
 * Puerta de entrada para el agente de WhatsApp.
 *
 * El agente conversa y extrae informacion; aqui se decide donde va. La idea es
 * que el agente no tenga que conocer el esquema del CRM: manda lo que entendio y
 * este modulo encuentra o crea el contacto, evita duplicados, deja la
 * conversacion en el timeline y agenda el siguiente paso.
 */
export type WhatsAppEvent = {
  /** Obligatorio: el telefono del que escribe, en cualquier formato. */
  telefono: string;
  /** Id del mensaje en el proveedor. Evita procesar dos veces la misma entrega. */
  idExterno?: string;
  nombre?: string;
  mensaje?: string;
  direccion?: "entrada" | "salida";
  fecha?: string;

  // Lo que el agente pudo extraer de la conversacion.
  correo?: string;
  empresa?: string;
  cargo?: string;
  ciudad?: string;
  pais?: string;
  segmento?: "b2b" | "b2c";
  /** Nombre del producto tal como lo diria una persona. Se empareja al catalogo. */
  producto?: string;
  fuente?: string;
  campana?: string;

  /** Senales de calificacion. */
  urgencia?: "alta" | "media" | "baja";
  presupuesto?: string;
  resumen?: string;
  /** Sugerencia del agente para el siguiente paso. */
  siguientePaso?: string;
  fechaSiguientePaso?: string;
  /** Si el agente considera que hay que escalar a un humano. */
  escalar?: boolean;
  motivoEscalamiento?: string;
};

export type IngestResult = {
  contactId: string;
  contactCreado: boolean;
  companyId: string | null;
  opportunityId: string | null;
  opportunityCreada: boolean;
  puntaje: number;
  escalado: boolean;
  duplicadoIgnorado: boolean;
};

export async function ingestWhatsApp(event: WhatsAppEvent): Promise<IngestResult> {
  const db = await getDb();
  const phone = normalizePhone(event.telefono);
  if (!phone) throw new Error("El teléfono no es valido");

  const email = normalizeEmail(event.correo);
  const occurredAt = event.fecha ? new Date(event.fecha) : new Date();

  // 1 y 2. Encontrar el contacto o crearlo, sin duplicar.
  let [contact] = await db
    .select()
    .from(contacts)
    .where(
      and(
        isNull(contacts.deletedAt),
        email
          ? or(eq(contacts.phoneNormalized, phone), eq(contacts.emailNormalized, email))!
          : eq(contacts.phoneNormalized, phone),
      ),
    )
    .limit(1);

  // 6 y 7. Empresa y cargo.
  let companyId: string | null = contact?.companyId ?? null;
  if (!companyId && (event.empresa || corporateDomain(email))) {
    companyId = await findOrCreateCompany(event.empresa ?? null, email);
  }

  const sourceId = await resolveSource(event.fuente ?? "WhatsApp");
  const campaignId = event.campana ? await resolveCampaign(event.campana) : null;
  const productId = event.producto ? await resolveProduct(event.producto) : null;
  // 4. B2B o B2C: si hay empresa, es corporativo.
  const segment = event.segmento ?? (companyId ? "b2b" : "b2c");

  let contactCreado = false;
  if (!contact) {
    const [created] = await db
      .insert(contacts)
      .values({
        fullName: normalizeName(event.nombre ?? "") || `WhatsApp ${phone.slice(-4)}`,
        phone: event.telefono,
        phoneNormalized: phone,
        email,
        emailNormalized: email,
        companyId,
        position: event.cargo ?? null,
        city: event.ciudad ?? null,
        country: event.pais ?? "Colombia",
        segment,
        sourceId,
        firstTouchSourceId: sourceId,
        lastTouchSourceId: sourceId,
        campaignId,
        interestProductId: productId,
        status: "nuevo",
        notes: event.resumen ?? null,
        lastInteractionAt: occurredAt,
      })
      .returning();
    contact = created!;
    contactCreado = true;
  } else {
    // Solo se completa lo que falta: el agente no sobreescribe datos verificados.
    await db
      .update(contacts)
      .set({
        fullName: contact.fullName.startsWith("WhatsApp ") && event.nombre
          ? normalizeName(event.nombre)
          : contact.fullName,
        email: contact.email ?? email,
        emailNormalized: contact.emailNormalized ?? email,
        companyId: contact.companyId ?? companyId,
        position: contact.position ?? event.cargo ?? null,
        city: contact.city ?? event.ciudad ?? null,
        country: contact.country ?? event.pais ?? null,
        interestProductId: contact.interestProductId ?? productId,
        // 3 y 11. El ultimo toque siempre se actualiza: sirve para atribucion.
        lastTouchSourceId: sourceId,
        lastInteractionAt: occurredAt,
        notes: event.resumen
          ? [contact.notes, event.resumen].filter(Boolean).join("\n\n")
          : contact.notes,
        updatedAt: new Date(),
      })
      .where(eq(contacts.id, contact.id));
    companyId = contact.companyId ?? companyId;
  }

  // 3 y 10. La conversacion en el timeline. El idExterno evita duplicar entregas.
  const interactionId = await logEvent({
    kind: "whatsapp",
    direction: event.direccion ?? "entrada",
    title: event.resumen ?? (event.mensaje ? event.mensaje.slice(0, 120) : "Mensaje de WhatsApp"),
    body: event.mensaje ?? null,
    occurredAt,
    contactId: contact.id,
    companyId,
    userId: null,
    externalId: event.idExterno ? `whatsapp:${event.idExterno}` : null,
    meta: {
      urgencia: event.urgencia ?? null,
      presupuesto: event.presupuesto ?? null,
      producto: event.producto ?? null,
    },
  });

  const duplicadoIgnorado = event.idExterno !== undefined && interactionId === null;

  // 12. Negocio: se abre o se actualiza cuando hay senal de compra.
  const stages = await getStages();
  const activeSlugs = new Set(stages.filter((s) => s.kind === "activa").map((s) => s.slug));
  let [openOpp] = await db
    .select()
    .from(opportunities)
    .where(and(eq(opportunities.contactId, contact.id), isNull(opportunities.deletedAt)))
    .limit(1);
  if (openOpp && !activeSlugs.has(openOpp.stage)) openOpp = undefined as never;

  let opportunityCreada = false;
  const budget = event.presupuesto ? parseMoneyInput(event.presupuesto) : 0;
  const hasBuyingSignal = Boolean(productId || budget > 0 || event.urgencia === "alta");

  if (!openOpp && hasBuyingSignal) {
    const [product] = productId
      ? await db.select().from(products).where(eq(products.id, productId)).limit(1)
      : [undefined];
    const amount = budget > 0 ? budget : Number(product?.promoPrice ?? product?.defaultPrice ?? 0);
    const firstStage = stages.find((s) => s.slug === "nuevo-lead") ?? stages[0]!;
    const [created] = await db
      .insert(opportunities)
      .values({
        name: product ? `${product.name}, ${contact.fullName}` : `Interes de ${contact.fullName}`,
        contactId: contact.id,
        companyId,
        segment,
        productId,
        amount: toMoneyString(amount),
        currency: product?.currency ?? "COP",
        stage: firstStage.slug,
        probability: firstStage.probability,
        sourceId,
        campaignId,
        lastInteractionAt: occurredAt,
      })
      .returning();
    openOpp = created!;
    opportunityCreada = true;

    await db
      .update(contacts)
      .set({ status: "oportunidad", updatedAt: new Date() })
      .where(eq(contacts.id, contact.id));
  } else if (openOpp) {
    await db
      .update(opportunities)
      .set({ lastInteractionAt: occurredAt, updatedAt: new Date() })
      .where(eq(opportunities.id, openOpp.id));
  }

  // 13. Siempre queda un siguiente paso. Un lead sin accion se pierde.
  const dueAt = event.fechaSiguientePaso
    ? (toDate(event.fechaSiguientePaso) ?? new Date())
    : addDays(new Date(), event.urgencia === "alta" ? 0 : 1);
  await ensureTask({
    autoKey: `whatsapp:${contact.id}:${occurredAt.toISOString().slice(0, 10)}`,
    title: event.siguientePaso ?? `Responder a ${contact.fullName} por WhatsApp`,
    kind: "llamar",
    dueAt,
    responsibleId: null,
    contactId: contact.id,
    companyId,
    opportunityId: openOpp?.id ?? null,
    notes: event.resumen ?? null,
  });

  // 11. Puntaje al dia con lo que se acaba de saber.
  const puntaje = await recalcLeadScore(contact.id);

  // 14. Escalamiento de leads de alto valor o cuando el agente lo pide.
  const cfg = await followUpSettings();
  const highValue = openOpp ? Number(openOpp.amount) >= cfg.highValueCop : false;
  const escalar = Boolean(event.escalar) || highValue || puntaje >= 70;

  if (escalar) {
    await escalate({
      contactId: contact.id,
      companyId,
      opportunityId: openOpp?.id ?? null,
      contactName: contact.fullName,
      reason:
        event.motivoEscalamiento ??
        (highValue ? "Negocio de alto valor detectado en WhatsApp" : "Lead con puntaje alto"),
      score: puntaje,
    });
  }

  return {
    contactId: contact.id,
    contactCreado,
    companyId,
    opportunityId: openOpp?.id ?? null,
    opportunityCreada,
    puntaje,
    escalado: escalar,
    duplicadoIgnorado,
  };
}

/** Avisa al equipo: crea el pendiente y la notificacion interna. */
async function escalate(input: {
  contactId: string;
  companyId: string | null;
  opportunityId: string | null;
  contactName: string;
  reason: string;
  score: number;
}): Promise<void> {
  const db = await getDb();
  const { notifications } = await import("@/db/schema");

  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.active, true), isNull(users.deletedAt)));

  await ensureTask({
    autoKey: `escalamiento:${input.contactId}`,
    title: `Atender a ${input.contactName}: ${input.reason}`,
    kind: "llamar",
    dueAt: new Date(),
    responsibleId: admins[0]?.id ?? null,
    contactId: input.contactId,
    companyId: input.companyId,
    opportunityId: input.opportunityId,
    notes: `Escalado desde WhatsApp. Puntaje ${input.score} de 100.`,
  });

  for (const admin of admins) {
    await db.insert(notifications).values({
      userId: admin.id,
      kind: "escalamiento",
      title: `Lead para atender: ${input.contactName}`,
      body: input.reason,
      link: input.opportunityId ? `/negocios/${input.opportunityId}` : `/contactos/${input.contactId}`,
    });
  }
}

async function findOrCreateCompany(name: string | null, email: string | null): Promise<string | null> {
  const db = await getDb();
  const domain = corporateDomain(email);
  if (!name && !domain) return null;

  const all = await db
    .select({ id: companies.id, name: companies.name, domain: companies.domain })
    .from(companies)
    .where(isNull(companies.deletedAt));

  const key = name ? companyKey(name) : null;
  const match =
    (key ? all.find((c) => companyKey(c.name) === key) : undefined) ??
    (domain ? all.find((c) => c.domain === domain) : undefined);
  if (match) return match.id;

  const [created] = await db
    .insert(companies)
    .values({
      name: name ? normalizeName(name) : domain!,
      domain: domain ?? null,
    })
    .returning({ id: companies.id });
  return created!.id;
}

async function resolveSource(name: string): Promise<string | null> {
  const db = await getDb();
  const all = await db.select({ id: leadSources.id, name: leadSources.name }).from(leadSources);
  return all.find((s) => foldCase(s.name) === foldCase(name))?.id ?? null;
}

async function resolveCampaign(name: string): Promise<string | null> {
  const db = await getDb();
  const all = await db.select({ id: campaigns.id, name: campaigns.name }).from(campaigns);
  return all.find((c) => foldCase(c.name) === foldCase(name))?.id ?? null;
}

/**
 * Empareja lo que dijo el cliente con un producto del catálogo.
 *
 * El orden importa y es una decisión comercial, no técnica. Un "bootcamp" a
 * secas por WhatsApp casi siempre es el Abierto: quien quiere un In-House lo
 * dice ("para mi equipo", "corporativo", "in-house"). Emparejar por
 * coincidencia suelta mandaba ese caso al programa de 15 millones e inflaba el
 * pipeline con negocios que nadie pidió.
 */
async function resolveProduct(text: string): Promise<string | null> {
  const db = await getDb();
  const all = await db
    .select({ id: products.id, name: products.name, category: products.category })
    .from(products)
    .where(isNull(products.deletedAt));
  const query = foldCase(text);
  if (!query) return null;

  // 1. El nombre exacto del producto.
  const exact = all.find((p) => foldCase(p.name) === query);
  if (exact) return exact.id;

  // 2. El cliente nombro el producto completo dentro de una frase. Gana el
  //    nombre mas largo: "Bootcamp In-House, dos días" sobre "Bootcamp".
  const named = all
    .filter((p) => query.includes(foldCase(p.name)))
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (named) return named.id;

  // 3. Palabras clave del portafolio, de lo mas especifico a lo mas general.
  const keywords: [RegExp, string][] = [
    [/in.?house.*(dos|2)|(\bdos\b|\b2\b).*in.?house|16 horas|dos dias|2 dias/, "bootcamp-inhouse"],
    [/in.?house|corporativ|para (mi|nuestro) equipo|para la empresa|grupo cerrado/, "bootcamp-inhouse"],
    [/diplomado|cinco semanas|5 semanas/, "diplomado"],
    [/masterclass|personas dificiles|gente dificil|seminario/, "masterclass"],
    [/libro fisico|libro impreso|combo de libros/, "libros-fisicos"],
    [/libro|ebook|digital|pdf/, "libros-digitales"],
    [/asesoria|consultoria|acompanamiento|1 a 1|uno a uno|negociacion critica/, "consultoria"],
    [/conferencia|keynote|charla|congreso|convencion|speaker/, "conferencia"],
    [/varias cohortes|programa a la medida|programa de varias/, "programa-corporativo"],
    [/curso asincronico|curso on demand|curso grabado/, "otro"],
    // El mas generico va de ultimo, a proposito.
    [/bootcamp|presencial|un dia|abierto/, "bootcamp-abierto"],
  ];
  for (const [pattern, category] of keywords) {
    if (pattern.test(query)) {
      const match = all.find((p) => p.category === category);
      if (match) return match.id;
    }
  }

  // 4. Un unico producto cuyo nombre contiene lo que dijo el cliente. Con
  //    varios candidatos no se adivina: se deja sin producto y el equipo decide.
  const candidatos = all.filter((p) => foldCase(p.name).includes(query));
  return candidatos.length === 1 ? candidatos[0]!.id : null;
}
