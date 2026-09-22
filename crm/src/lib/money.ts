import type { Currency } from "@/db/enums";

/**
 * El dinero se guarda como numeric en Postgres y viaja como string. Todo el
 * formateo pasa por aqui para que no aparezcan dos formatos en pantalla.
 */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Guarda con dos decimales, siempre como string, para la columna numeric. */
export function toMoneyString(value: string | number | null | undefined): string {
  return toNumber(value).toFixed(2);
}

// Solo los digitos: el codigo de moneda se escribe aparte. Con "$" a secas no
// se distingue un peso de un dolar, y aqui se manejan los dos.
const DIGITS = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
const DIGITS_2 = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatMoney(
  value: string | number | null | undefined,
  currency: Currency = "COP",
): string {
  const n = toNumber(value);
  // Los valores en dolares del portafolio son cifras pequenas (USD 99, USD 18):
  // ahi un decimal suelto se nota, en un total de pesos estorba.
  const digits = Number.isInteger(n) ? DIGITS.format(n) : DIGITS_2.format(n);
  return `${currency} ${digits}`;
}

/** Version corta para tarjetas y KPI: COP 29,0 M. */
export function formatMoneyShort(
  value: string | number | null | undefined,
  currency: Currency = "COP",
): string {
  const n = toNumber(value);
  const abs = Math.abs(n);
  const prefix = currency === "USD" ? "USD" : "COP";
  if (abs >= 1_000_000_000) return `${prefix} ${(n / 1_000_000_000).toFixed(1).replace(".", ",")} MM`;
  if (abs >= 1_000_000) return `${prefix} ${(n / 1_000_000).toFixed(1).replace(".", ",")} M`;
  if (abs >= 1_000) return `${prefix} ${Math.round(n / 1_000)} mil`;
  return `${prefix} ${Math.round(n)}`;
}

/** Singular y plural, para no escribir "1 pagos vencidos". */
export function plural(count: number, singular: string, pluralForm?: string): string {
  return `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-CO").format(value);
}

export function formatPercent(value: number, decimals = 0): string {
  return `${value.toFixed(decimals).replace(".", ",")} %`;
}

export const IVA_RATE = 19;

/** El IVA del 19% se cobra solo a quien necesita factura electronica. */
export function withTax(amount: string | number | null | undefined, taxRate: string | number): number {
  const base = toNumber(amount);
  return base * (1 + toNumber(taxRate) / 100);
}

/**
 * Los montos en monedas distintas no se suman a ciegas. Para los totales del
 * tablero se convierte a COP con una tasa de referencia configurable.
 */
export function convertToCop(
  amount: string | number | null | undefined,
  currency: Currency,
  usdRate: number,
): number {
  const n = toNumber(amount);
  return currency === "USD" ? n * usdRate : n;
}

export function parseMoneyInput(raw: string): number {
  // Acepta "29.000.000", "29,000,000", "29000000" y "1.500,50".
  const cleaned = raw.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return 0;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  let normalized: string;
  if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    normalized = cleaned.replace(/,/g, "");
    // Un punto con tres digitos detras es separador de miles, no decimal.
    const tail = normalized.slice(lastDot + 1);
    if (tail.length === 3) normalized = normalized.replace(/\./g, "");
  } else {
    normalized = cleaned;
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}
