/**
 * Semillas del CRM.
 *
 * Dos partes bien separadas:
 *   1. Configuracion real del negocio: usuarios, etapas, fuentes y el tarifario
 *      vigente de Jose I. Tobon Consultores.
 *   2. Datos de demostracion, todos marcados is_demo = true, para poder evaluar
 *      la interfaz de una vez y borrarlos despues desde Ajustes.
 *
 * Es idempotente: se puede volver a correr sin duplicar nada.
 */
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { openDb } from "./_db";
import * as s from "../src/db/schema";
import { DEFAULT_SOURCES, DEFAULT_STAGES } from "../src/db/enums";
import { computeLeadScore } from "../src/lib/scoring";

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "TobonCRM2026";

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}
function daysAhead(n: number): Date {
  return new Date(Date.now() + n * 86_400_000);
}
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function at(d: Date, hour: number): Date {
  const copy = new Date(d);
  copy.setHours(hour, 0, 0, 0);
  return copy;
}


/**
 * Calcula el puntaje de cada contacto con la misma funcion que usa la
 * aplicacion. Se hace aqui en lugar de importar lib/automation porque ese
 * modulo es "server-only" y no corre en un script de consola.
 */
async function scoreAllContacts(db: Awaited<ReturnType<typeof openDb>>["db"]) {
  const contactRows = await db.select().from(s.contacts);
  const companyRows = await db.select().from(s.companies);
  const productRows = await db.select().from(s.products);
  const oppRows = await db.select().from(s.opportunities);
  const proposalRows = await db.select().from(s.proposals);
  const stageRows = await db.select().from(s.pipelineStages);
  const activeStages = new Set(stageRows.filter((r) => r.kind === "activa").map((r) => r.slug));

  const counts = await db
    .select({
      contactId: s.interactions.contactId,
      total: sql<number>`count(*)::int`,
      inbound: sql<number>`count(*) filter (where ${s.interactions.direction} = 'entrada')::int`,
    })
    .from(s.interactions)
    .groupBy(s.interactions.contactId);
  const countMap = new Map(counts.map((c) => [c.contactId, c]));

  let scored = 0;
  for (const contact of contactRows) {
    const company = companyRows.find((c) => c.id === contact.companyId);
    const product = productRows.find((p) => p.id === contact.interestProductId);
    const price = product?.defaultPrice
      ? Number(product.defaultPrice) * (product.currency === "USD" ? 4000 : 1)
      : null;
    const openValue = oppRows
      .filter((o) => o.contactId === contact.id && activeStages.has(o.stage))
      .reduce((acc, o) => acc + Number(o.amount) * (o.currency === "USD" ? 4000 : 1), 0);
    const stats = countMap.get(contact.id);

    const { score, factors } = computeLeadScore({
      segment: contact.segment,
      position: contact.position,
      companyName: company?.name ?? null,
      purchasingCapacity: company?.purchasingCapacity ?? null,
      interestProductName: product?.name ?? null,
      interestProductPrice: price,
      hasEmail: Boolean(contact.emailNormalized),
      hasPhone: Boolean(contact.phoneNormalized),
      interactionCount: stats?.total ?? 0,
      inboundCount: stats?.inbound ?? 0,
      lastInteractionAt: contact.lastInteractionAt,
      openOpportunityValue: openValue,
      hasProposal: proposalRows.some((p) => p.contactId === contact.id),
      createdAt: contact.createdAt,
    });

    await db
      .update(s.contacts)
      .set({ leadScore: contact.leadScoreManual ?? score, leadScoreBreakdown: factors })
      .where(eq(s.contacts.id, contact.id));
    scored += 1;
  }
  console.log(`  puntajes       ${scored} contactos`);
}

async function main() {
  const { db, close, mode } = await openDb();
  console.log(`Base de datos: ${mode}`);

  // ───────────── 1. Usuarios ─────────────
  const hash = await bcrypt.hash(SEED_PASSWORD, 10);
  const people = [
    { name: "José Ignacio Tobón", email: "director@joseitobon.com", role: "admin" as const },
    { name: "Ricardo Tobón", email: "ricardo@joseitobon.com", role: "admin" as const },
    { name: "Coordinación Comercial", email: "comercial@joseitobon.com", role: "equipo" as const },
  ];
  const userIds: Record<string, string> = {};
  for (const p of people) {
    const [existing] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.email, p.email)).limit(1);
    if (existing) {
      userIds[p.email] = existing.id;
      continue;
    }
    const [row] = await db
      .insert(s.users)
      .values({ ...p, passwordHash: hash, mustChangePassword: true })
      .returning({ id: s.users.id });
    userIds[p.email] = row!.id;
  }
  const jose = userIds["director@joseitobon.com"]!;
  const ricardo = userIds["ricardo@joseitobon.com"]!;
  const coord = userIds["comercial@joseitobon.com"]!;
  console.log(`  usuarios       ${people.length}`);

  // ───────────── 2. Etapas del pipeline ─────────────
  for (const stage of DEFAULT_STAGES) {
    await db.insert(s.pipelineStages).values(stage).onConflictDoNothing();
  }
  console.log(`  etapas         ${DEFAULT_STAGES.length}`);

  // ───────────── 3. Fuentes ─────────────
  const sourceIds: Record<string, string> = {};
  for (let i = 0; i < DEFAULT_SOURCES.length; i += 1) {
    const name = DEFAULT_SOURCES[i]!;
    const slug = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-");
    await db.insert(s.leadSources).values({ name, slug, sort: (i + 1) * 10 }).onConflictDoNothing();
    const [row] = await db.select({ id: s.leadSources.id }).from(s.leadSources).where(eq(s.leadSources.slug, slug)).limit(1);
    sourceIds[name] = row!.id;
  }
  console.log(`  fuentes        ${DEFAULT_SOURCES.length}`);

  // ───────────── 4. Catalogo vigente ─────────────
  // Tarifario del documento maestro de contexto. Todo editable desde Ajustes.
  const catalog = [
    {
      name: "Bootcamp In-House, un día",
      category: "bootcamp-inhouse" as const,
      audience: "b2b" as const,
      defaultPrice: "15000000.00",
      currency: "COP" as const,
      unit: "programa",
      sort: 10,
      description: "Programa corporativo presencial de un día, adaptado al contexto de la organización. Viajes, alojamiento y viaticos no incluidos.",
    },
    {
      name: "Bootcamp In-House, dos días",
      category: "bootcamp-inhouse" as const,
      audience: "b2b" as const,
      defaultPrice: "29000000.00",
      currency: "COP" as const,
      unit: "programa",
      sort: 20,
      description: "Dos días, 16 horas. Diagnóstico previo, casos adaptados, simulaciones y plan de transferencia. Viajes y viaticos aparte.",
    },
    {
      name: "Bootcamp Abierto de Negociación",
      category: "bootcamp-abierto" as const,
      audience: "b2c" as const,
      defaultPrice: "980000.00",
      currency: "COP" as const,
      unit: "persona",
      sort: 30,
      description: "Presencial, un día, 8:00 a 17:00. Para 3 o más participantes de la misma organización se consulta condición especial.",
    },
    {
      name: "Diplomado Online en Negociación",
      category: "diplomado" as const,
      audience: "ambos" as const,
      defaultPrice: "3900000.00",
      promoPrice: "3499000.00",
      promoLabel: "Pago anticipado",
      currency: "COP" as const,
      unit: "persona",
      sort: 40,
      description: "Cinco semanas, cinco módulos, unas 40 horas. Sin cupo máximo. La fecha limite del pago anticipado se confirma antes de cerrar.",
    },
    {
      name: "Masterclass: negociar con personas difíciles",
      category: "masterclass" as const,
      audience: "ambos" as const,
      defaultPrice: "99.00",
      currency: "USD" as const,
      unit: "persona",
      sort: 50,
      description: "Online en vivo. Confirmar fecha y precio de la edición vigente antes de prometer nada.",
    },
    {
      name: "Libro fisico",
      category: "libros-fisicos" as const,
      audience: "b2c" as const,
      defaultPrice: "115000.00",
      currency: "COP" as const,
      unit: "unidad",
      taxable: false,
      sort: 60,
      description: "Un libro COP 115.000. Combo de dos, COP 190.000.",
    },
    {
      name: "Combo de dos libros fisicos",
      category: "libros-fisicos" as const,
      audience: "b2c" as const,
      defaultPrice: "190000.00",
      currency: "COP" as const,
      unit: "combo",
      taxable: false,
      sort: 70,
      description: "Al comprar uno por COP 115.000, el segundo queda en COP 75.000 adicionales.",
    },
    {
      name: "Libro digital",
      category: "libros-digitales" as const,
      audience: "b2c" as const,
      defaultPrice: "55000.00",
      currency: "COP" as const,
      unit: "titulo",
      taxable: false,
      sort: 80,
      description: "23 títulos disponibles. También USD 18 por título.",
    },
    {
      name: "Asesoría 1:1 y negociación crítica",
      category: "consultoria" as const,
      audience: "ambos" as const,
      defaultPrice: null,
      currency: "COP" as const,
      unit: "según alcance",
      sort: 90,
      description: "No se cotiza automáticamente. Se califica el caso y se escala.",
    },
    {
      name: "Conferencia o keynote",
      category: "conferencia" as const,
      audience: "b2b" as const,
      defaultPrice: null,
      currency: "COP" as const,
      unit: "evento",
      sort: 100,
      description: "Sin tarifa pública. Toda solicitud se escala con ciudad, fecha, audiencia y duración.",
    },
    {
      name: "Programa corporativo personalizado",
      category: "programa-corporativo" as const,
      audience: "b2b" as const,
      defaultPrice: null,
      currency: "COP" as const,
      unit: "programa",
      sort: 110,
      description: "Varias cohortes o varias semanas. Se escala para diseño y cotización.",
    },
    {
      name: "Curso asincrónico",
      category: "otro" as const,
      audience: "ambos" as const,
      defaultPrice: null,
      currency: "COP" as const,
      unit: "curso",
      sort: 120,
      description: "Validar el precio de cada curso antes de cotizar. No usar precios históricos.",
    },
  ];

  const productIds: Record<string, string> = {};
  for (const item of catalog) {
    const [existing] = await db.select({ id: s.products.id }).from(s.products).where(eq(s.products.name, item.name)).limit(1);
    if (existing) {
      productIds[item.name] = existing.id;
      continue;
    }
    const [row] = await db.insert(s.products).values(item).returning({ id: s.products.id });
    productIds[item.name] = row!.id;
  }
  console.log(`  productos      ${catalog.length}`);

  // ───────────── 5. Campanas ─────────────
  const campaignSeed = [
    { name: "Meta Ads Bootcamp Septiembre", source: "Meta Ads", channel: "Meta", budget: "4500000.00" },
    { name: "Diplomado Noviembre 2026", source: "Meta Ads", channel: "Meta", budget: "8000000.00" },
    { name: "Masterclass Personas Difíciles Octubre", source: "Instagram", channel: "Instagram", budget: "1800000.00" },
    { name: "Prospección corporativa Q4", source: "Prospección directa", channel: "Outbound", budget: null },
  ];
  const campaignIds: Record<string, string> = {};
  for (const c of campaignSeed) {
    const [existing] = await db.select({ id: s.campaigns.id }).from(s.campaigns).where(eq(s.campaigns.name, c.name)).limit(1);
    if (existing) {
      campaignIds[c.name] = existing.id;
      continue;
    }
    const [row] = await db
      .insert(s.campaigns)
      .values({
        name: c.name,
        sourceId: sourceIds[c.source] ?? null,
        channel: c.channel,
        budget: c.budget,
        startsOn: iso(daysAgo(45)),
      })
      .returning({ id: s.campaigns.id });
    campaignIds[c.name] = row!.id;
  }
  console.log(`  campanas       ${campaignSeed.length}`);

  // ───────────── 6. Ajustes ─────────────
  for (const [key, value] of [
    ["finanzas", { usdRate: 4000, ivaRate: 19, defaultPaymentTermDays: 30, invoicePrefix: "FV", proposalPrefix: "P" }],
    ["seguimiento", { proposalFollowUpDays: 3, staleDays: [3, 7, 14, 30], highValueCop: 10_000_000 }],
    [
      "negocio",
      {
        name: "José I. Tobón",
        tagline: "Expertos en Negociación",
        email: "director@joseitobon.com",
        whatsapp: "+57 321 746 7350",
        website: "joseitobon.com",
        city: "Medellín, Colombia",
      },
    ],
  ] as const) {
    await db.insert(s.settings).values({ key, value }).onConflictDoNothing();
  }

  // ───────────── 7. Datos de demostracion ─────────────
  const [already] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.companies)
    .where(eq(s.companies.isDemo, true));
  if ((already?.n ?? 0) > 0) {
    console.log("  demo           ya existe, no se duplica");
    // Los puntajes se recalculan igual: pueden haber cambiado los datos.
    await scoreAllContacts(db);
    await close();
    return;
  }

  const demo = { isDemo: true };

  const companySeed = [
    {
      key: "dorex",
      name: "Dorex Cargo S.A.S.",
      website: "https://dorexcargo.com",
      domain: "dorexcargo.com",
      industry: "Logística y transporte",
      country: "Colombia",
      city: "Bogotá",
      size: "201-1000",
      purchasingCapacity: "alta" as const,
      responsibleId: ricardo,
      sourceId: sourceIds["Referido"]!,
      notes: "Area de compras con equipo de 14 negociadores. El gerente general conoce a José Ignacio de una conferencia.",
    },
    {
      key: "andina",
      name: "Manufacturas Andina",
      website: "https://manufacturasandina.co",
      domain: "manufacturasandina.co",
      industry: "Manufactura",
      country: "Colombia",
      city: "Medellín",
      size: "51-200",
      purchasingCapacity: "media" as const,
      responsibleId: jose,
      sourceId: sourceIds["Prospección directa"]!,
      notes: "Pierden margen en negociación con grandes superficies. Interesados en un programa para el equipo comercial.",
    },
    {
      key: "seguros",
      name: "Seguros del Pacífico",
      website: "https://segurosdelpacifico.com",
      domain: "segurosdelpacifico.com",
      industry: "Servicios financieros",
      country: "Colombia",
      city: "Cali",
      size: "1000+",
      purchasingCapacity: "alta" as const,
      responsibleId: ricardo,
      sourceId: sourceIds["LinkedIn"]!,
      notes: "Quieren formar a la fuerza de ventas. Proceso de compras formal, requiere factura electrónica.",
    },
    {
      key: "agroval",
      name: "Agroval del Valle",
      industry: "Agroindustria",
      country: "Colombia",
      city: "Palmira",
      size: "51-200",
      purchasingCapacity: "media" as const,
      responsibleId: coord,
      sourceId: sourceIds["Evento"]!,
      notes: "Contacto en una feria del sector. Interes inicial en el Bootcamp Abierto para dos personas.",
    },
    {
      key: "tecnolab",
      name: "Tecnolab Soluciones",
      website: "https://tecnolab.io",
      domain: "tecnolab.io",
      industry: "Tecnología",
      country: "México",
      city: "Ciudad de México",
      size: "11-50",
      purchasingCapacity: "media" as const,
      responsibleId: jose,
      sourceId: sourceIds["Sitio web"]!,
      notes: "Startup en expansión. Preguntaron por la masterclass y por el Diplomado en modalidad online.",
    },
  ];

  const companyIds: Record<string, string> = {};
  for (const c of companySeed) {
    const { key, ...values } = c;
    const [row] = await db
      .insert(s.companies)
      .values({ ...values, ...demo, createdBy: ricardo, updatedBy: ricardo })
      .returning({ id: s.companies.id });
    companyIds[key] = row!.id;
  }

  const contactSeed = [
    {
      key: "juan",
      fullName: "Juan Pérez",
      phone: "3117854412",
      email: "juan.perez@dorexcargo.com",
      company: "dorex",
      position: "Gerente Comercial",
      city: "Bogotá",
      segment: "b2b" as const,
      source: "Referido",
      product: "Bootcamp In-House, dos días",
      responsibleId: ricardo,
      status: "oportunidad" as const,
      notes: "Necesita aprobación de gerencia general. Prefiere fechas de noviembre.",
    },
    {
      key: "marcela",
      fullName: "Marcela Restrepo",
      phone: "3156620098",
      email: "mrestrepo@manufacturasandina.co",
      company: "andina",
      position: "Directora de Ventas",
      city: "Medellín",
      segment: "b2b" as const,
      source: "Prospección directa",
      product: "Bootcamp In-House, un día",
      responsibleId: jose,
      status: "calificado" as const,
      notes: "Equipo de 22 vendedores. Pidió una conversación de diagnóstico antes de cotizar.",
    },
    {
      key: "andres",
      fullName: "Andrés Villa",
      phone: "3204471120",
      email: "avilla@segurosdelpacifico.com",
      company: "seguros",
      position: "Vicepresidente Comercial",
      city: "Cali",
      segment: "b2b" as const,
      source: "LinkedIn",
      product: "Programa corporativo personalizado",
      responsibleId: ricardo,
      status: "oportunidad" as const,
      notes: "Requiere factura electrónica. Compras exige tres cotizaciones.",
    },
    {
      key: "liliana",
      fullName: "Liliana Cardona",
      phone: "3012298877",
      email: "liliana.cardona@agroval.co",
      company: "agroval",
      position: "Jefe de Compras",
      city: "Palmira",
      segment: "b2b" as const,
      source: "Evento",
      product: "Bootcamp Abierto de Negociación",
      responsibleId: coord,
      status: "contactado" as const,
      notes: "Quiere enviar dos personas. Pregunto si hay descuento por grupo.",
    },
    {
      key: "carlos",
      fullName: "Carlos Mendoza",
      phone: "3183345567",
      email: "carlos.mendoza@tecnolab.io",
      company: "tecnolab",
      position: "Director de Operaciones",
      city: "Ciudad de México",
      country: "México",
      segment: "b2b" as const,
      source: "Sitio web",
      product: "Diplomado Online en Negociación",
      responsibleId: jose,
      status: "calificado" as const,
      notes: "Consulto por la edición de noviembre y por pago en dólares.",
    },
    {
      key: "diana",
      fullName: "Diana Quintero",
      phone: "3145567788",
      email: "dianaquintero@gmail.com",
      position: "Abogada independiente",
      city: "Medellín",
      segment: "b2c" as const,
      source: "Meta Ads",
      campaign: "Meta Ads Bootcamp Septiembre",
      product: "Bootcamp Abierto de Negociación",
      responsibleId: coord,
      status: "nuevo" as const,
      notes: "Llego por un anuncio. Pregunto la fecha del próximo Bootcamp y si incluye almuerzo.",
    },
    {
      key: "felipe",
      fullName: "Felipe Ochoa",
      phone: "3001122334",
      email: "felipe.ochoa@outlook.com",
      city: "Barranquilla",
      segment: "b2c" as const,
      source: "Instagram",
      campaign: "Masterclass Personas Difíciles Octubre",
      product: "Masterclass: negociar con personas difíciles",
      responsibleId: coord,
      status: "nuevo" as const,
      notes: "Interesado en la masterclass de octubre. Dijo que su jefe es una persona muy difícil.",
    },
    {
      key: "sandra",
      fullName: "Sandra López",
      phone: "3178890011",
      email: "sandra.lopez@gmail.com",
      city: "Bogotá",
      segment: "b2c" as const,
      source: "Meta Ads",
      campaign: "Diplomado Noviembre 2026",
      product: "Diplomado Online en Negociación",
      responsibleId: coord,
      status: "cliente" as const,
      notes: "Compro el Diplomado con pago anticipado. No necesita factura electrónica.",
    },
  ];

  const contactIds: Record<string, string> = {};
  for (const c of contactSeed) {
    const { key, company, source, campaign, product, ...rest } = c;
    const [row] = await db
      .insert(s.contacts)
      .values({
        ...rest,
        country: rest.country ?? "Colombia",
        phoneNormalized: `57${c.phone}`,
        emailNormalized: c.email.toLowerCase(),
        companyId: company ? companyIds[company]! : null,
        sourceId: sourceIds[source]!,
        firstTouchSourceId: sourceIds[source]!,
        lastTouchSourceId: sourceIds[source]!,
        campaignId: campaign ? campaignIds[campaign]! : null,
        interestProductId: product ? productIds[product]! : null,
        lastInteractionAt: daysAgo(Math.floor(Math.random() * 9) + 1),
        ...demo,
        createdBy: ricardo,
        updatedBy: ricardo,
      })
      .returning({ id: s.contacts.id });
    contactIds[key] = row!.id;
  }

  // Etiquetas
  for (const name of ["Alta prioridad", "Compras", "Referido", "Requiere factura"]) {
    await db.insert(s.tags).values({ name }).onConflictDoNothing();
  }
  const [tagAlta] = await db.select({ id: s.tags.id }).from(s.tags).where(eq(s.tags.name, "Alta prioridad")).limit(1);
  const [tagFactura] = await db.select({ id: s.tags.id }).from(s.tags).where(eq(s.tags.name, "Requiere factura")).limit(1);
  await db
    .insert(s.contactTags)
    .values([
      { contactId: contactIds.juan!, tagId: tagAlta!.id },
      { contactId: contactIds.andres!, tagId: tagAlta!.id },
      { contactId: contactIds.andres!, tagId: tagFactura!.id },
    ])
    .onConflictDoNothing();

  // ───────────── Negocios ─────────────
  const oppSeed = [
    {
      key: "dorex2d",
      name: "Bootcamp In-House dos días, Dorex Cargo",
      contact: "juan",
      company: "dorex",
      product: "Bootcamp In-House, dos días",
      amount: "29000000.00",
      stage: "propuesta-enviada",
      probability: 55,
      requiresInvoice: true,
      taxRate: "19",
      expectedCloseOn: iso(daysAhead(18)),
      responsibleId: ricardo,
      source: "Referido",
      proposalStatus: "enviada" as const,
      billingStatus: "pendiente" as const,
      lastInteractionAt: daysAgo(3),
    },
    {
      key: "andina1d",
      name: "Bootcamp In-House un día, Manufacturas Andina",
      contact: "marcela",
      company: "andina",
      product: "Bootcamp In-House, un día",
      amount: "15000000.00",
      stage: "reunion-realizada",
      probability: 40,
      requiresInvoice: true,
      taxRate: "19",
      expectedCloseOn: iso(daysAhead(30)),
      responsibleId: jose,
      source: "Prospección directa",
      lastInteractionAt: daysAgo(8),
    },
    {
      key: "seguros",
      name: "Programa corporativo, Seguros del Pacífico",
      contact: "andres",
      company: "seguros",
      product: "Programa corporativo personalizado",
      amount: "58000000.00",
      stage: "negociacion",
      probability: 70,
      requiresInvoice: true,
      taxRate: "19",
      expectedCloseOn: iso(daysAhead(25)),
      responsibleId: ricardo,
      source: "LinkedIn",
      proposalStatus: "en-revision" as const,
      billingStatus: "pendiente" as const,
      lastInteractionAt: daysAgo(16),
    },
    {
      key: "agroval",
      name: "Bootcamp Abierto, dos cupos Agroval",
      contact: "liliana",
      company: "agroval",
      product: "Bootcamp Abierto de Negociación",
      amount: "1960000.00",
      stage: "calificado",
      probability: 20,
      requiresInvoice: false,
      expectedCloseOn: iso(daysAhead(12)),
      responsibleId: coord,
      source: "Evento",
      lastInteractionAt: daysAgo(2),
    },
    {
      key: "tecnolab",
      name: "Diplomado Online, Tecnolab",
      contact: "carlos",
      company: "tecnolab",
      product: "Diplomado Online en Negociación",
      amount: "3499000.00",
      stage: "seguimiento",
      probability: 60,
      requiresInvoice: false,
      expectedCloseOn: iso(daysAhead(9)),
      responsibleId: jose,
      source: "Sitio web",
      proposalStatus: "enviada" as const,
      lastInteractionAt: daysAgo(11),
    },
    {
      key: "sandra",
      name: "Diplomado Online, Sandra López",
      contact: "sandra",
      product: "Diplomado Online en Negociación",
      amount: "3499000.00",
      stage: "ganado",
      probability: 100,
      requiresInvoice: false,
      segment: "b2c" as const,
      expectedCloseOn: iso(daysAgo(12)),
      closedAt: daysAgo(12),
      responsibleId: coord,
      source: "Meta Ads",
      campaign: "Diplomado Noviembre 2026",
      proposalStatus: "aceptada" as const,
      billingStatus: "no-requiere" as const,
      paymentStatus: "pagado" as const,
      deliveryStatus: "programado" as const,
      lastInteractionAt: daysAgo(10),
    },
    {
      key: "diana",
      name: "Bootcamp Abierto, Diana Quintero",
      contact: "diana",
      product: "Bootcamp Abierto de Negociación",
      amount: "980000.00",
      stage: "nuevo-lead",
      probability: 5,
      requiresInvoice: false,
      segment: "b2c" as const,
      responsibleId: coord,
      source: "Meta Ads",
      campaign: "Meta Ads Bootcamp Septiembre",
      lastInteractionAt: daysAgo(1),
    },
    {
      key: "felipe",
      name: "Masterclass, Felipe Ochoa",
      contact: "felipe",
      product: "Masterclass: negociar con personas difíciles",
      amount: "99.00",
      currency: "USD" as const,
      stage: "contactado",
      probability: 10,
      requiresInvoice: false,
      segment: "b2c" as const,
      responsibleId: coord,
      source: "Instagram",
      campaign: "Masterclass Personas Difíciles Octubre",
      lastInteractionAt: daysAgo(4),
    },
    {
      key: "perdido",
      name: "Bootcamp In-House, Constructora Norte",
      product: "Bootcamp In-House, un día",
      amount: "15000000.00",
      stage: "perdido",
      probability: 0,
      requiresInvoice: true,
      taxRate: "19",
      closedAt: daysAgo(25),
      lostReason: "Presupuesto no aprobado",
      responsibleId: ricardo,
      source: "Referido",
      lastInteractionAt: daysAgo(26),
    },
  ];

  const oppIds: Record<string, string> = {};
  for (const o of oppSeed) {
    const { key, contact, company, product, source, campaign, ...rest } = o;
    const [row] = await db
      .insert(s.opportunities)
      .values({
        ...rest,
        segment: rest.segment ?? "b2b",
        currency: rest.currency ?? "COP",
        contactId: contact ? contactIds[contact]! : null,
        companyId: company ? companyIds[company]! : null,
        productId: productIds[product]!,
        sourceId: sourceIds[source]!,
        campaignId: campaign ? campaignIds[campaign]! : null,
        stageChangedAt: daysAgo(Math.floor(Math.random() * 12) + 2),
        ...demo,
        createdBy: ricardo,
        updatedBy: ricardo,
      })
      .returning({ id: s.opportunities.id });
    oppIds[key] = row!.id;
  }

  // ───────────── Propuestas ─────────────
  const proposalSeed = [
    {
      key: "dorex",
      number: "P-2026-001",
      title: "Bootcamp In-House dos días, Dorex Cargo",
      opp: "dorex2d",
      contact: "juan",
      company: "dorex",
      product: "Bootcamp In-House, dos días",
      amount: "29000000.00",
      status: "enviada" as const,
      version: 2,
      sentAt: daysAgo(4),
      expiresOn: iso(daysAhead(11)),
      responsibleId: ricardo,
    },
    {
      key: "seguros",
      number: "P-2026-002",
      title: "Programa corporativo, Seguros del Pacífico",
      opp: "seguros",
      contact: "andres",
      company: "seguros",
      product: "Programa corporativo personalizado",
      amount: "58000000.00",
      status: "en-revision" as const,
      version: 1,
      sentAt: daysAgo(16),
      expiresOn: iso(daysAhead(4)),
      responsibleId: ricardo,
    },
    {
      key: "tecnolab",
      number: "P-2026-003",
      title: "Diplomado Online, Tecnolab",
      opp: "tecnolab",
      contact: "carlos",
      company: "tecnolab",
      product: "Diplomado Online en Negociación",
      amount: "3499000.00",
      status: "enviada" as const,
      version: 1,
      sentAt: daysAgo(11),
      expiresOn: iso(daysAhead(2)),
      responsibleId: jose,
    },
    {
      key: "sandra",
      number: "P-2026-004",
      title: "Diplomado Online, Sandra López",
      opp: "sandra",
      contact: "sandra",
      product: "Diplomado Online en Negociación",
      amount: "3499000.00",
      status: "aceptada" as const,
      version: 1,
      sentAt: daysAgo(16),
      respondedAt: daysAgo(12),
      responsibleId: coord,
    },
  ];

  const proposalIds: Record<string, string> = {};
  for (const p of proposalSeed) {
    const { key, opp, contact, company, product, version, ...rest } = p;
    const [row] = await db
      .insert(s.proposals)
      .values({
        ...rest,
        currentVersion: version,
        opportunityId: oppIds[opp]!,
        contactId: contactIds[contact]!,
        companyId: company ? companyIds[company]! : null,
        productId: productIds[product]!,
        ...demo,
        createdBy: ricardo,
      })
      .returning({ id: s.proposals.id });
    proposalIds[key] = row!.id;

    for (let v = 1; v <= version; v += 1) {
      await db.insert(s.proposalVersions).values({
        proposalId: row!.id,
        version: v,
        amount: v === version ? p.amount : "32000000.00",
        status: v === version ? p.status : "cambios-solicitados",
        sentAt: v === version ? p.sentAt : daysAgo(9),
        expiresOn: p.expiresOn ?? null,
        notes: v === version ? null : "El cliente pidió ajustar el alcance y quitar la sesión de cierre.",
        createdBy: ricardo,
      });
    }
  }

  // ───────────── Facturas y pagos ─────────────
  const [invDorex] = await db
    .insert(s.invoices)
    .values({
      number: "FV-2026-001",
      opportunityId: oppIds.seguros!,
      contactId: contactIds.andres!,
      companyId: companyIds.seguros!,
      issueDate: iso(daysAgo(40)),
      dueDate: iso(daysAgo(10)),
      amount: "12000000.00",
      taxRate: "19",
      currency: "COP",
      status: "enviada",
      responsibleId: ricardo,
      accountingNotes: "Anticipo del 20 por ciento del programa corporativo.",
      ...demo,
      createdBy: ricardo,
    })
    .returning({ id: s.invoices.id });

  // Pago vencido: el anticipo de Seguros del Pacifico.
  await db.insert(s.payments).values({
    invoiceId: invDorex!.id,
    opportunityId: oppIds.seguros!,
    contactId: contactIds.andres!,
    companyId: companyIds.seguros!,
    amount: "14280000.00",
    currency: "COP",
    expectedOn: iso(daysAgo(10)),
    status: "vencido",
    notes: "Anticipo de la factura FV-2026-001. Compras dijo que el pago salia el viernes pasado.",
    ...demo,
    createdBy: ricardo,
  });

  // Pago parcial: Dorex pago la mitad del In-House.
  const [invDorex2] = await db
    .insert(s.invoices)
    .values({
      number: "FV-2026-002",
      opportunityId: oppIds.dorex2d!,
      contactId: contactIds.juan!,
      companyId: companyIds.dorex!,
      issueDate: iso(daysAgo(6)),
      dueDate: iso(daysAhead(24)),
      amount: "29000000.00",
      taxRate: "19",
      currency: "COP",
      status: "enviada",
      responsibleId: ricardo,
      ...demo,
      createdBy: ricardo,
    })
    .returning({ id: s.invoices.id });

  await db.insert(s.payments).values([
    {
      invoiceId: invDorex2!.id,
      opportunityId: oppIds.dorex2d!,
      contactId: contactIds.juan!,
      companyId: companyIds.dorex!,
      amount: "17255000.00",
      currency: "COP",
      expectedOn: iso(daysAgo(4)),
      paidOn: iso(daysAgo(4)),
      method: "transferencia",
      reference: "TRF-889120",
      status: "pagado",
      notes: "Primera cuota del 50 por ciento.",
      ...demo,
      createdBy: ricardo,
    },
    {
      invoiceId: invDorex2!.id,
      opportunityId: oppIds.dorex2d!,
      contactId: contactIds.juan!,
      companyId: companyIds.dorex!,
      amount: "17255000.00",
      currency: "COP",
      expectedOn: iso(daysAhead(24)),
      status: "pendiente",
      notes: "Segunda cuota, contra entrega del programa.",
      ...demo,
      createdBy: ricardo,
    },
    {
      opportunityId: oppIds.sandra!,
      contactId: contactIds.sandra!,
      amount: "3499000.00",
      currency: "COP",
      expectedOn: iso(daysAgo(12)),
      paidOn: iso(daysAgo(12)),
      method: "bold",
      reference: "BOLD-4471",
      status: "pagado",
      notes: "Pago anticipado del Diplomado por la pasarela.",
      ...demo,
      createdBy: coord,
    },
  ]);

  await db.insert(s.invoices).values({
    number: "FV-2026-003",
    opportunityId: oppIds.andina1d!,
    contactId: contactIds.marcela!,
    companyId: companyIds.andina!,
    amount: "15000000.00",
    taxRate: "19",
    currency: "COP",
    status: "pendiente",
    responsibleId: jose,
    accountingNotes: "Esperando la orden de compra para emitir.",
    ...demo,
    createdBy: jose,
  });

  // ───────────── Entrega de servicio ─────────────
  await db.insert(s.serviceDeliveries).values([
    {
      title: "Diplomado Online, cohorte de noviembre",
      opportunityId: oppIds.sandra!,
      productId: productIds["Diplomado Online en Negociación"]!,
      contactId: contactIds.sandra!,
      status: "programado",
      scheduledAt: at(daysAhead(48), 17),
      isOnline: true,
      location: "Zoom",
      responsibleId: coord,
      notes: "Inicio de la cohorte. Confirmar el envío de accesos una semana antes.",
      ...demo,
      createdBy: coord,
    },
    {
      title: "Bootcamp In-House Dorex Cargo, día 1",
      opportunityId: oppIds.dorex2d!,
      productId: productIds["Bootcamp In-House, dos días"]!,
      companyId: companyIds.dorex!,
      contactId: contactIds.juan!,
      status: "por-programar",
      responsibleId: ricardo,
      notes: "Falta confirmar fechas de noviembre y la sede en Bogotá.",
      ...demo,
      createdBy: ricardo,
    },
  ]);

  // ───────────── Pendientes ─────────────
  const taskSeed = [
    {
      title: "Hacer seguimiento a la propuesta de Dorex Cargo",
      kind: "esperar-respuesta" as const,
      dueAt: at(daysAgo(1), 9),
      contact: "juan",
      company: "dorex",
      opp: "dorex2d",
      responsibleId: ricardo,
      waitingFor: "propuesta" as const,
      notes: "Juan dijo que necesitaba aprobación de gerencia general.",
    },
    {
      title: "Confirmar el pago del anticipo de Seguros del Pacífico",
      kind: "seguimiento-pago" as const,
      dueAt: at(new Date(), 10),
      contact: "andres",
      company: "seguros",
      opp: "seguros",
      responsibleId: ricardo,
      waitingFor: "pago" as const,
      notes: "El pago estaba prometido para el viernes pasado.",
    },
    {
      title: "Enviar información del Bootcamp a Diana",
      kind: "enviar-informacion" as const,
      dueAt: at(new Date(), 15),
      contact: "diana",
      opp: "diana",
      responsibleId: coord,
      notes: "Pregunto la fecha del próximo Bootcamp y si incluye almuerzo.",
    },
    {
      title: "Llamar a Liliana por la condición de dos cupos",
      kind: "llamar" as const,
      dueAt: at(new Date(), 11),
      contact: "liliana",
      company: "agroval",
      opp: "agroval",
      responsibleId: coord,
      notes: "Para 3 o más hay condición especial. Con dos hay que consultar y no prometer número.",
    },
    {
      title: "Preparar propuesta para Manufacturas Andina",
      kind: "enviar-propuesta" as const,
      dueAt: at(daysAgo(2), 9),
      contact: "marcela",
      company: "andina",
      opp: "andina1d",
      responsibleId: jose,
      notes: "La conversación de diagnóstico ya se hizo. Quedó pendiente la propuesta.",
    },
    {
      title: "Emitir factura de Manufacturas Andina",
      kind: "emitir-factura" as const,
      dueAt: at(daysAhead(2), 9),
      contact: "marcela",
      company: "andina",
      opp: "andina1d",
      responsibleId: jose,
    },
    {
      title: "Confirmar fechas del In-House con Dorex",
      kind: "coordinar-servicio" as const,
      dueAt: at(daysAhead(3), 9),
      contact: "juan",
      company: "dorex",
      opp: "dorex2d",
      responsibleId: ricardo,
    },
    {
      title: "Responder a Carlos sobre pago en dólares",
      kind: "esperar-respuesta" as const,
      dueAt: at(daysAhead(1), 9),
      contact: "carlos",
      company: "tecnolab",
      opp: "tecnolab",
      responsibleId: jose,
      waitingFor: "cliente" as const,
    },
  ];

  for (const t of taskSeed) {
    const { contact, company, opp, ...rest } = t;
    await db.insert(s.tasks).values({
      ...rest,
      contactId: contact ? contactIds[contact]! : null,
      companyId: company ? companyIds[company]! : null,
      opportunityId: opp ? oppIds[opp]! : null,
      autoKey: randomUUID(),
      ...demo,
      createdBy: ricardo,
    });
  }

  // ───────────── Timeline ─────────────
  const timeline = [
    { kind: "whatsapp" as const, direction: "entrada" as const, title: "Consulta por el Bootcamp In-House", body: "Buenas tardes, quisiera información del programa para nuestro equipo de compras.", contact: "juan", company: "dorex", opp: "dorex2d", days: 24 },
    { kind: "whatsapp" as const, direction: "salida" as const, title: "Respuesta con el portafolio corporativo", contact: "juan", company: "dorex", opp: "dorex2d", days: 24 },
    { kind: "llamada" as const, direction: "salida" as const, title: "Llamada de calificación", body: "Equipo de 14 negociadores. Dolor: descuentos que no se defienden. Decide el gerente general.", contact: "juan", company: "dorex", opp: "dorex2d", days: 20 },
    { kind: "reunion" as const, direction: "salida" as const, title: "Reunión de diagnóstico realizada", body: "Se acordo el alcance de dos días con casos del sector logistico.", contact: "juan", company: "dorex", opp: "dorex2d", days: 14 },
    { kind: "propuesta" as const, direction: "salida" as const, title: "Propuesta P-2026-001 enviada", amount: "32000000.00", currency: "COP" as const, contact: "juan", company: "dorex", opp: "dorex2d", days: 12 },
    { kind: "email" as const, direction: "entrada" as const, title: "Correo recibido: solicitud de ajustes", body: "El cliente pidió quitar la sesión de cierre y ajustar el valor.", contact: "juan", company: "dorex", opp: "dorex2d", days: 9 },
    { kind: "propuesta" as const, direction: "salida" as const, title: "Propuesta P-2026-001 versión 2 enviada", amount: "29000000.00", currency: "COP" as const, contact: "juan", company: "dorex", opp: "dorex2d", days: 4 },
    { kind: "factura" as const, title: "Factura FV-2026-002 enviada", amount: "29000000.00", currency: "COP" as const, contact: "juan", company: "dorex", opp: "dorex2d", days: 6 },
    { kind: "pago" as const, direction: "entrada" as const, title: "Pago parcial recibido", amount: "17255000.00", currency: "COP" as const, contact: "juan", company: "dorex", opp: "dorex2d", days: 4 },
    { kind: "llamada" as const, direction: "salida" as const, title: "Llamada de seguimiento", body: "Juan confirmó que la propuesta esta en revisión de gerencia.", contact: "juan", company: "dorex", opp: "dorex2d", days: 3 },

    { kind: "email" as const, direction: "salida" as const, title: "Correo de prospección", contact: "marcela", company: "andina", opp: "andina1d", days: 30 },
    { kind: "reunion" as const, direction: "salida" as const, title: "Conversación de diagnóstico realizada", body: "Pierden margen con grandes superficies. 22 vendedores. Quieren un piloto de un día.", contact: "marcela", company: "andina", opp: "andina1d", days: 8 },

    { kind: "email" as const, direction: "entrada" as const, title: "Correo recibido: solicitud de cotización formal", contact: "andres", company: "seguros", opp: "seguros", days: 22 },
    { kind: "propuesta" as const, direction: "salida" as const, title: "Propuesta P-2026-002 enviada", amount: "58000000.00", currency: "COP" as const, contact: "andres", company: "seguros", opp: "seguros", days: 16 },
    { kind: "factura" as const, title: "Factura FV-2026-001 enviada", amount: "12000000.00", currency: "COP" as const, contact: "andres", company: "seguros", opp: "seguros", days: 40 },

    { kind: "whatsapp" as const, direction: "entrada" as const, title: "Consulta por dos cupos del Bootcamp", contact: "liliana", company: "agroval", opp: "agroval", days: 2 },
    { kind: "whatsapp" as const, direction: "entrada" as const, title: "Consulta desde el anuncio de Meta", body: "Hola, vi el anuncio del Bootcamp. Cuando es el próximo y que incluye?", contact: "diana", opp: "diana", days: 1 },
    { kind: "whatsapp" as const, direction: "entrada" as const, title: "Consulta por la masterclass de octubre", contact: "felipe", opp: "felipe", days: 4 },
    { kind: "email" as const, direction: "entrada" as const, title: "Correo recibido: pago en dólares", body: "Consulto si el Diplomado se puede pagar en dólares desde México.", contact: "carlos", company: "tecnolab", opp: "tecnolab", days: 11 },
    { kind: "propuesta" as const, direction: "salida" as const, title: "Propuesta P-2026-004 aceptada", amount: "3499000.00", currency: "COP" as const, contact: "sandra", opp: "sandra", days: 12 },
    { kind: "pago" as const, direction: "entrada" as const, title: "Pago recibido", amount: "3499000.00", currency: "COP" as const, contact: "sandra", opp: "sandra", days: 12 },
    { kind: "servicio" as const, title: "Servicio programado: Diplomado cohorte de noviembre", contact: "sandra", opp: "sandra", days: 10 },
  ];

  for (const e of timeline) {
    const { contact, company, opp, days, ...rest } = e;
    await db.insert(s.interactions).values({
      ...rest,
      occurredAt: at(daysAgo(days), 10 + (days % 7)),
      contactId: contact ? contactIds[contact]! : null,
      companyId: company ? companyIds[company]! : null,
      opportunityId: opp ? oppIds[opp]! : null,
      userId: ricardo,
      externalId: `demo:${randomUUID()}`,
      ...demo,
    });
  }

  await scoreAllContacts(db);

  console.log(`  empresas       ${companySeed.length} (demo)`);
  console.log(`  contactos      ${contactSeed.length} (demo)`);
  console.log(`  negocios       ${oppSeed.length} (demo)`);
  console.log(`  propuestas     ${proposalSeed.length} (demo)`);
  console.log(`  pendientes     ${taskSeed.length} (demo)`);
  console.log(`  timeline       ${timeline.length} eventos (demo)`);
  console.log("");
  console.log("Usuarios creados. Contraseña inicial para los tres:");
  console.log(`  ${SEED_PASSWORD}`);
  console.log("Cambiala en Ajustes, Mi cuenta, en el primer ingreso.");

  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
