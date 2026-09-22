import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { settings } from "@/db/schema";

/** Configuracion del negocio. Vive en la base para que se edite sin desplegar. */
export type FinanceSettings = {
  /** Tasa de referencia para mostrar totales mixtos en pesos. No es contabilidad. */
  usdRate: number;
  /** El IVA solo aplica a quien necesita factura electronica. */
  ivaRate: number;
  defaultPaymentTermDays: number;
  invoicePrefix: string;
  proposalPrefix: string;
};

export type FollowUpSettings = {
  /** Dias sin respuesta tras enviar una propuesta antes de crear el seguimiento. */
  proposalFollowUpDays: number;
  /** Umbrales de silencio que marcan un negocio como descuidado. */
  staleDays: number[];
  /** Valor desde el cual un negocio se considera de alto valor. */
  highValueCop: number;
};

export const DEFAULT_FINANCE: FinanceSettings = {
  usdRate: 4000,
  ivaRate: 19,
  defaultPaymentTermDays: 30,
  invoicePrefix: "FV",
  proposalPrefix: "P",
};

export const DEFAULT_FOLLOWUP: FollowUpSettings = {
  proposalFollowUpDays: 3,
  staleDays: [3, 7, 14, 30],
  highValueCop: 10_000_000,
};

export async function readSetting<T>(key: string, fallback: T): Promise<T> {
  const db = await getDb();
  const [row] = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  if (!row) return fallback;
  return { ...fallback, ...(row.value as object) } as T;
}

export async function writeSetting(key: string, value: unknown, userId: string | null): Promise<void> {
  const db = await getDb();
  await db
    .insert(settings)
    .values({ key, value, updatedBy: userId, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedBy: userId, updatedAt: new Date() },
    });
}

export const financeSettings = () => readSetting("finanzas", DEFAULT_FINANCE);
export const followUpSettings = () => readSetting("seguimiento", DEFAULT_FOLLOWUP);

export type BusinessSettings = {
  name: string;
  tagline: string;
  email: string;
  whatsapp: string;
  website: string;
  city: string;
};

export const DEFAULT_BUSINESS: BusinessSettings = {
  name: "José I. Tobón",
  tagline: "Expertos en Negociación",
  email: "director@joseitobon.com",
  whatsapp: "+57 321 746 7350",
  website: "joseitobon.com",
  city: "Medellín, Colombia",
};

export const businessSettings = () => readSetting("negocio", DEFAULT_BUSINESS);
