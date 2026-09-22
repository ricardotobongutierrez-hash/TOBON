/**
 * Puntaje de lead de 0 a 100, explicable.
 *
 * No hay modelo oculto: cada punto viene de un factor con nombre, y el desglose
 * se guarda en el contacto para que al hacer clic el usuario vea por que. Si
 * alguien fija el puntaje a mano, el calculo ya no lo sobreescribe.
 */
import type { PurchasingCapacity, Segment } from "@/db/enums";
import { daysBetween } from "./dates";

export type ScoreFactor = {
  factor: string;
  label: string;
  points: number;
  detail: string;
};

export type ScoreInput = {
  segment: Segment;
  position: string | null;
  companyName: string | null;
  purchasingCapacity: PurchasingCapacity | null;
  interestProductName: string | null;
  interestProductPrice: number | null;
  hasEmail: boolean;
  hasPhone: boolean;
  interactionCount: number;
  inboundCount: number;
  lastInteractionAt: Date | string | null;
  openOpportunityValue: number;
  hasProposal: boolean;
  createdAt: Date | string | null;
};

const DECISION_TITLES =
  /(ceo|presidente|director|gerente|vp|vicepresident|jefe|head|chief|socio|partner|owner|dueñ|propietari|founder|fundador|c-?level|cfo|coo|cco|chro)/i;

const INFLUENCER_TITLES = /(coordinador|lider|leader|supervisor|analista|especialista|manager)/i;

export function computeLeadScore(input: ScoreInput): { score: number; factors: ScoreFactor[] } {
  const factors: ScoreFactor[] = [];

  // 1. Capacidad de compra declarada (0-18)
  const capacityPoints: Record<PurchasingCapacity, number> = {
    alta: 18,
    media: 11,
    baja: 4,
    "sin-definir": 0,
  };
  const capacity = input.purchasingCapacity ?? "sin-definir";
  push(factors, "capacidad", "Capacidad de compra", capacityPoints[capacity], {
    alta: "La empresa está marcada con capacidad alta",
    media: "La empresa está marcada con capacidad media",
    baja: "La empresa está marcada con capacidad baja",
    "sin-definir": "Todavía no se registra capacidad de compra",
  }[capacity]);

  // 2. Autoridad de decision segun el cargo (0-16)
  let authority = 0;
  let authorityDetail = "No hay cargo registrado";
  if (input.position) {
    if (DECISION_TITLES.test(input.position)) {
      authority = 16;
      authorityDetail = `El cargo "${input.position}" suele decidir`;
    } else if (INFLUENCER_TITLES.test(input.position)) {
      authority = 9;
      authorityDetail = `El cargo "${input.position}" suele influir en la decision`;
    } else {
      authority = 4;
      authorityDetail = `Cargo registrado: ${input.position}`;
    }
  }
  push(factors, "autoridad", "Autoridad de decisión", authority, authorityDetail);

  // 3. Ajuste de empresa (0-12). El entrenamiento corporativo es el negocio grande.
  let fit = 0;
  let fitDetail = "Contacto individual (B2C)";
  if (input.segment === "b2b") {
    fit = input.companyName ? 12 : 7;
    fitDetail = input.companyName
      ? `Contacto corporativo de ${input.companyName}`
      : "Contacto corporativo sin empresa asignada";
  } else if (input.companyName) {
    fit = 4;
    fitDetail = `Persona con empresa asociada: ${input.companyName}`;
  }
  push(factors, "empresa", "Ajuste de empresa", fit, fitDetail);

  // 4. Ajuste de producto (0-14): pesa el valor del producto de interes.
  let product = 0;
  let productDetail = "Sin producto de interes registrado";
  if (input.interestProductName) {
    const price = input.interestProductPrice ?? 0;
    if (price >= 10_000_000) product = 14;
    else if (price >= 3_000_000) product = 10;
    else if (price >= 500_000) product = 6;
    else product = 3;
    productDetail = `Interesado en ${input.interestProductName}`;
  }
  push(factors, "producto", "Ajuste de producto", product, productDetail);

  // 5. Negocio abierto (0-14)
  let deal = 0;
  let dealDetail = "Sin negocio abierto";
  if (input.openOpportunityValue >= 20_000_000) {
    deal = 14;
    dealDetail = "Negocio abierto por encima de COP 20 millones";
  } else if (input.openOpportunityValue >= 5_000_000) {
    deal = 10;
    dealDetail = "Negocio abierto por encima de COP 5 millones";
  } else if (input.openOpportunityValue > 0) {
    deal = 6;
    dealDetail = "Tiene un negocio abierto";
  }
  push(factors, "negocio", "Negocio abierto", deal, dealDetail);

  // 6. Propuesta enviada (0-8)
  push(
    factors,
    "propuesta",
    "Propuesta en curso",
    input.hasProposal ? 8 : 0,
    input.hasProposal ? "Ya tiene al menos una propuesta" : "Todavía no hay propuesta",
  );

  // 7. Interaccion y respuesta (0-10)
  const engagement = Math.min(10, input.interactionCount * 2 + input.inboundCount);
  push(
    factors,
    "interaccion",
    "Nivel de conversación",
    engagement,
    `${input.interactionCount} interacciones registradas, ${input.inboundCount} iniciadas por el cliente`,
  );

  // 8. Recencia (0-8, puede restar)
  let recency = 0;
  let recencyDetail = "Nunca se ha registrado una interacción";
  if (input.lastInteractionAt) {
    const days = daysBetween(input.lastInteractionAt);
    if (days <= 3) {
      recency = 8;
      recencyDetail = "Contacto activo en los últimos 3 días";
    } else if (days <= 7) {
      recency = 6;
      recencyDetail = "Último contacto esta semana";
    } else if (days <= 14) {
      recency = 3;
      recencyDetail = "Último contacto hace menos de dos semanas";
    } else if (days <= 30) {
      recency = 0;
      recencyDetail = `Ultimo contacto hace ${days} dias`;
    } else {
      recency = -6;
      recencyDetail = `Sin contacto hace ${days} dias, el lead se esta enfriando`;
    }
  }
  push(factors, "recencia", "Recencia del contacto", recency, recencyDetail);

  // 9. Datos de contacto completos (0-6): sin forma de contactar, nada avanza.
  const reach = (input.hasEmail ? 3 : 0) + (input.hasPhone ? 3 : 0);
  push(
    factors,
    "datos",
    "Datos para contactar",
    reach,
    [input.hasEmail ? "correo" : null, input.hasPhone ? "teléfono o WhatsApp" : null]
      .filter(Boolean)
      .join(" y ") || "No hay correo ni telefono",
  );

  const raw = factors.reduce((acc, f) => acc + f.points, 0);
  const score = Math.max(0, Math.min(100, raw));
  return { score, factors };
}

function push(list: ScoreFactor[], factor: string, label: string, points: number, detail: string) {
  list.push({ factor, label, points, detail });
}

export function scoreBand(score: number): { label: string; tone: "verde" | "azul" | "ambar" | "gris" } {
  if (score >= 70) return { label: "Caliente", tone: "verde" };
  if (score >= 45) return { label: "Templado", tone: "azul" };
  if (score >= 20) return { label: "Frio", tone: "ambar" };
  return { label: "Sin calificar", tone: "gris" };
}
