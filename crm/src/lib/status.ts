import type { BadgeTone } from "@/components/ui/badge";
import {
  BILLING_STATUS_LABEL,
  CONTACT_STATUS_LABEL,
  DELIVERY_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  PROPOSAL_STATUS_LABEL,
  type BillingStatus,
  type ContactStatus,
  type DeliveryStatus,
  type PaymentStatus,
  type ProposalStatus,
  type StageKind,
} from "@/db/enums";

/**
 * Un solo lugar decide el color de cada estado, para que "Pagado" sea verde en
 * todas las pantallas. El texto siempre acompana al color.
 *
 *   verde  completado, pagado, ganado
 *   azul   activo, en curso
 *   ambar  requiere atencion
 *   rojo   vencido, critico
 *   gris   inactivo, perdido, archivado
 */
export type StatusChip = { label: string; tone: BadgeTone };

export function proposalChip(status: ProposalStatus): StatusChip {
  const tones: Record<ProposalStatus, BadgeTone> = {
    "sin-propuesta": "gris",
    borrador: "gris",
    "lista-para-enviar": "ambar",
    enviada: "azul",
    "en-revision": "azul",
    "cambios-solicitados": "ambar",
    aceptada: "verde",
    rechazada: "gris",
    vencida: "rojo",
  };
  return { label: PROPOSAL_STATUS_LABEL[status], tone: tones[status] };
}

export function billingChip(status: BillingStatus): StatusChip {
  const tones: Record<BillingStatus, BadgeTone> = {
    "no-requiere": "gris",
    pendiente: "ambar",
    emitida: "azul",
    enviada: "azul",
    vencida: "rojo",
    anulada: "gris",
  };
  return { label: BILLING_STATUS_LABEL[status], tone: tones[status] };
}

export function paymentChip(status: PaymentStatus): StatusChip {
  const tones: Record<PaymentStatus, BadgeTone> = {
    "no-vencido": "gris",
    pendiente: "ambar",
    parcial: "ambar",
    pagado: "verde",
    vencido: "rojo",
    reembolsado: "gris",
    // Ambar como un pendiente: hay algo que hacer, pero no es una deuda vencida.
    "por-conciliar": "ambar",
  };
  return { label: PAYMENT_STATUS_LABEL[status], tone: tones[status] };
}

export function deliveryChip(status: DeliveryStatus): StatusChip {
  const tones: Record<DeliveryStatus, BadgeTone> = {
    pendiente: "gris",
    "por-programar": "ambar",
    programado: "azul",
    "en-ejecucion": "azul",
    completado: "verde",
    cancelado: "gris",
  };
  return { label: DELIVERY_STATUS_LABEL[status], tone: tones[status] };
}

export function contactChip(status: ContactStatus): StatusChip {
  const tones: Record<ContactStatus, BadgeTone> = {
    nuevo: "acento",
    contactado: "azul",
    calificado: "azul",
    oportunidad: "azul",
    cliente: "verde",
    nutricion: "gris",
    descartado: "gris",
  };
  return { label: CONTACT_STATUS_LABEL[status], tone: tones[status] };
}

export function stageChip(name: string, kind: StageKind): StatusChip {
  const tones: Record<StageKind, BadgeTone> = {
    activa: "azul",
    ganado: "verde",
    perdido: "gris",
    nutricion: "gris",
  };
  return { label: name, tone: tones[kind] };
}

/** Semaforo de silencio: cuantos dias sin contacto empiezan a doler. */
export function silenceChip(days: number | null): StatusChip | null {
  if (days === null) return null;
  if (days >= 30) return { label: `Sin contacto hace ${days} dias`, tone: "rojo" };
  if (days >= 14) return { label: `Sin contacto hace ${days} dias`, tone: "rojo" };
  if (days >= 7) return { label: `Sin contacto hace ${days} dias`, tone: "ambar" };
  if (days >= 3) return { label: `Sin contacto hace ${days} dias`, tone: "ambar" };
  return null;
}

/** Antiguedad de una propuesta enviada sin respuesta. */
export function proposalAgeChip(days: number | null): StatusChip | null {
  if (days === null) return null;
  if (days >= 14) return { label: `${days} dias sin respuesta`, tone: "rojo" };
  if (days >= 7) return { label: `${days} dias sin respuesta`, tone: "rojo" };
  if (days >= 3) return { label: `${days} dias sin respuesta`, tone: "ambar" };
  return { label: `Enviada hace ${days} ${days === 1 ? "dia" : "dias"}`, tone: "azul" };
}
