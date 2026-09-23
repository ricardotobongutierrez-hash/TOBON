/**
 * Vocabulario del CRM. Vive en TypeScript y no como enum de Postgres a proposito:
 * el pipeline y las fuentes se editan desde Ajustes, y un enum de base de datos
 * obligaria una migracion cada vez que el negocio agrega una etapa.
 */

export const ROLES = ["admin", "equipo"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  equipo: "Equipo",
};

export const SEGMENTS = ["b2b", "b2c"] as const;
export type Segment = (typeof SEGMENTS)[number];

export const SEGMENT_LABEL: Record<Segment, string> = {
  b2b: "Empresa (B2B)",
  b2c: "Persona (B2C)",
};

/** Estado del contacto como lead. */
export const CONTACT_STATUSES = [
  "nuevo",
  "contactado",
  "calificado",
  "oportunidad",
  "cliente",
  "nutricion",
  "descartado",
] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const CONTACT_STATUS_LABEL: Record<ContactStatus, string> = {
  nuevo: "Nuevo",
  contactado: "Contactado",
  calificado: "Calificado",
  oportunidad: "Con negocio abierto",
  cliente: "Cliente",
  nutricion: "En nutrición",
  descartado: "Descartado",
};

/** Etapas del pipeline por defecto. Se pueden editar en Ajustes → Pipeline. */
export type StageKind = "activa" | "ganado" | "perdido" | "nutricion";

export const DEFAULT_STAGES: {
  slug: string;
  name: string;
  kind: StageKind;
  probability: number;
  sort: number;
}[] = [
  { slug: "nuevo-lead", name: "Nuevo lead", kind: "activa", probability: 5, sort: 10 },
  { slug: "contactado", name: "Contactado", kind: "activa", probability: 10, sort: 20 },
  { slug: "calificado", name: "Calificado", kind: "activa", probability: 20, sort: 30 },
  { slug: "reunion-agendada", name: "Reunión agendada", kind: "activa", probability: 30, sort: 40 },
  { slug: "reunion-realizada", name: "Reunión realizada", kind: "activa", probability: 40, sort: 50 },
  { slug: "propuesta-por-preparar", name: "Propuesta por preparar", kind: "activa", probability: 45, sort: 60 },
  { slug: "propuesta-enviada", name: "Propuesta enviada", kind: "activa", probability: 55, sort: 70 },
  { slug: "seguimiento", name: "Seguimiento", kind: "activa", probability: 60, sort: 80 },
  { slug: "negociacion", name: "Negociación", kind: "activa", probability: 70, sort: 90 },
  { slug: "decision-pendiente", name: "Decisión pendiente", kind: "activa", probability: 80, sort: 100 },
  { slug: "ganado", name: "Ganado", kind: "ganado", probability: 100, sort: 110 },
  { slug: "perdido", name: "Perdido", kind: "perdido", probability: 0, sort: 120 },
  { slug: "nutricion", name: "Nutrición", kind: "nutricion", probability: 5, sort: 130 },
];

/** Los cinco ciclos de vida de un negocio, separados a proposito. */
export const PROPOSAL_STATUSES = [
  "sin-propuesta",
  "borrador",
  "lista-para-enviar",
  "enviada",
  "en-revision",
  "cambios-solicitados",
  "aceptada",
  "rechazada",
  "vencida",
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  "sin-propuesta": "Sin propuesta",
  borrador: "Borrador",
  "lista-para-enviar": "Lista para enviar",
  enviada: "Enviada",
  "en-revision": "En revisión",
  "cambios-solicitados": "Cambios solicitados",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  vencida: "Vencida",
};

export const BILLING_STATUSES = [
  "no-requiere",
  "pendiente",
  "emitida",
  "enviada",
  "vencida",
  "anulada",
] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];

export const BILLING_STATUS_LABEL: Record<BillingStatus, string> = {
  "no-requiere": "No requiere factura",
  pendiente: "Factura pendiente",
  emitida: "Factura emitida",
  enviada: "Factura enviada",
  vencida: "Factura vencida",
  anulada: "Factura anulada",
};

export const PAYMENT_STATUSES = [
  "no-vencido",
  "pendiente",
  "parcial",
  "pagado",
  "vencido",
  "reembolsado",
  "por-conciliar",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  "no-vencido": "No vencido",
  pendiente: "Pago pendiente",
  parcial: "Pago parcial",
  pagado: "Pagado",
  vencido: "Pago vencido",
  reembolsado: "Reembolsado",
  // Asistio o se inscribio, pero el pago no se ha cruzado contra factura o banco.
  "por-conciliar": "Pago por conciliar",
};

export const DELIVERY_STATUSES = [
  "pendiente",
  "por-programar",
  "programado",
  "en-ejecucion",
  "completado",
  "cancelado",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  pendiente: "Pendiente",
  "por-programar": "Por programar",
  programado: "Programado",
  "en-ejecucion": "En ejecución",
  completado: "Completado",
  cancelado: "Cancelado",
};

/** Tipos de evento del timeline unificado. */
export const INTERACTION_KINDS = [
  "whatsapp",
  "email",
  "llamada",
  "reunion",
  "nota",
  "tarea",
  "propuesta",
  "factura",
  "pago",
  "servicio",
  "estado",
] as const;
export type InteractionKind = (typeof INTERACTION_KINDS)[number];

export const INTERACTION_KIND_LABEL: Record<InteractionKind, string> = {
  whatsapp: "WhatsApp",
  email: "Correo",
  llamada: "Llamada",
  reunion: "Reunión",
  nota: "Nota",
  tarea: "Seguimiento",
  propuesta: "Propuesta",
  factura: "Factura",
  pago: "Pago",
  servicio: "Servicio",
  estado: "Cambio de estado",
};

export const TASK_KINDS = [
  "llamar",
  "enviar-informacion",
  "enviar-propuesta",
  "esperar-respuesta",
  "seguimiento-pago",
  "agendar-reunion",
  "emitir-factura",
  "coordinar-servicio",
  "otro",
] as const;
export type TaskKind = (typeof TASK_KINDS)[number];

export const TASK_KIND_LABEL: Record<TaskKind, string> = {
  llamar: "Llamar nuevamente",
  "enviar-informacion": "Enviar información",
  "enviar-propuesta": "Enviar propuesta",
  "esperar-respuesta": "Esperar respuesta",
  "seguimiento-pago": "Seguimiento de pago",
  "agendar-reunion": "Agendar reunión",
  "emitir-factura": "Emitir factura",
  "coordinar-servicio": "Coordinar servicio",
  otro: "Otro",
};

/** Por que estamos esperando. Alimenta las secciones de Pendientes. */
export const WAITING_FOR = ["ninguno", "cliente", "propuesta", "pago"] as const;
export type WaitingFor = (typeof WAITING_FOR)[number];

export const CURRENCIES = ["COP", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const COMPANY_SIZES = [
  "1-10",
  "11-50",
  "51-200",
  "201-1000",
  "1000+",
] as const;

export const PURCHASING_CAPACITY = ["alta", "media", "baja", "sin-definir"] as const;
export type PurchasingCapacity = (typeof PURCHASING_CAPACITY)[number];

export const PURCHASING_CAPACITY_LABEL: Record<PurchasingCapacity, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
  "sin-definir": "Sin definir",
};

export const PAYMENT_METHODS = [
  "transferencia",
  "bold",
  "tarjeta",
  "efectivo",
  "pse",
  "otro",
] as const;

export const DEFAULT_SOURCES = [
  "Meta Ads",
  "Instagram",
  "Facebook",
  "Sitio web",
  "WhatsApp",
  "Correo",
  "Referido",
  "Cliente existente",
  "LinkedIn",
  "Evento",
  "Orgánico",
  "Prospección directa",
  "Otro",
];

export const PRODUCT_CATEGORIES = [
  "bootcamp-inhouse",
  "bootcamp-abierto",
  "diplomado",
  "masterclass",
  "libros-fisicos",
  "libros-digitales",
  "consultoria",
  "conferencia",
  "programa-corporativo",
  "otro",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_CATEGORY_LABEL: Record<ProductCategory, string> = {
  "bootcamp-inhouse": "Bootcamp In-House",
  "bootcamp-abierto": "Bootcamp Abierto",
  diplomado: "Diplomado Online",
  masterclass: "Masterclass",
  "libros-fisicos": "Libros fisicos",
  "libros-digitales": "Libros digitales",
  consultoria: "Consultoría y asesoría",
  conferencia: "Conferencias y speaking",
  "programa-corporativo": "Programa corporativo",
  otro: "Otro",
};

export const LOST_REASONS = [
  "Precio",
  "Presupuesto no aprobado",
  "Tiempo o agenda",
  "Eligio otro proveedor",
  "Sin respuesta",
  "No era el momento",
  "No calificaba",
  "Otro",
];
