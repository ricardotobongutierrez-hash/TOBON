/**
 * Normalizacion de telefonos, correos, paises y nombres de empresa.
 * Es lo que hace posible que la importacion de CSV y el futuro agente de
 * WhatsApp encuentren el contacto que ya existe en vez de crear un duplicado.
 */

const DEFAULT_COUNTRY_CODE = process.env.DEFAULT_COUNTRY_CODE ?? "57";

/** Deja solo digitos y agrega el indicativo de Colombia cuando falta. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  // 00 57 300... → 57 300...
  digits = digits.replace(/^00/, "");
  // Un celular colombiano son 10 digitos y empieza por 3.
  if (digits.length === 10 && digits.startsWith("3")) digits = DEFAULT_COUNTRY_CODE + digits;
  // Un fijo de Bogota son 10 digitos empezando por 60.
  else if (digits.length === 10 && digits.startsWith("60")) digits = DEFAULT_COUNTRY_CODE + digits;
  else if (digits.length === 7) digits = `${DEFAULT_COUNTRY_CODE}60${digits}`;
  return digits.length >= 8 ? digits : null;
}

/** +57 321 746 7350 */
export function formatPhone(raw: string | null | undefined): string {
  const n = normalizePhone(raw);
  if (!n) return raw ?? "—";
  if (n.startsWith("57") && n.length === 12) {
    return `+57 ${n.slice(2, 5)} ${n.slice(5, 8)} ${n.slice(8)}`;
  }
  if (n.length === 11) return `+${n.slice(0, 1)} ${n.slice(1, 4)} ${n.slice(4, 7)} ${n.slice(7)}`;
  return `+${n}`;
}

export function whatsappLink(raw: string | null | undefined): string | null {
  const n = normalizePhone(raw);
  return n ? `https://wa.me/${n}` : null;
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const value = raw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return null;
  return value;
}

export function isValidEmail(raw: string | null | undefined): boolean {
  return normalizeEmail(raw) !== null;
}

const FREE_MAIL = new Set([
  "gmail.com",
  "hotmail.com",
  "outlook.com",
  "outlook.es",
  "yahoo.com",
  "yahoo.es",
  "icloud.com",
  "live.com",
  "protonmail.com",
  "me.com",
  "aol.com",
]);

/** Dominio corporativo del correo. Los gratuitos no identifican empresa. */
export function corporateDomain(email: string | null | undefined): string | null {
  const e = normalizeEmail(email);
  if (!e) return null;
  const domain = e.split("@")[1]!;
  return FREE_MAIL.has(domain) ? null : domain;
}

export function isFreeMailDomain(domain: string | null | undefined): boolean {
  return domain ? FREE_MAIL.has(domain.toLowerCase()) : false;
}

export function normalizeWebsite(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  try {
    const url = new URL(value);
    return url.origin + (url.pathname === "/" ? "" : url.pathname);
  } catch {
    return null;
  }
}

export function domainFromWebsite(raw: string | null | undefined): string | null {
  const site = normalizeWebsite(raw);
  if (!site) return null;
  try {
    return new URL(site).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

const COUNTRY_ALIASES: Record<string, string> = {
  co: "Colombia",
  col: "Colombia",
  colombia: "Colombia",
  mx: "México",
  mex: "México",
  mexico: "México",
  pe: "Perú",
  peru: "Perú",
  cl: "Chile",
  chile: "Chile",
  ar: "Argentina",
  argentina: "Argentina",
  ec: "Ecuador",
  ecuador: "Ecuador",
  pa: "Panamá",
  panama: "Panamá",
  cr: "Costa Rica",
  "costa rica": "Costa Rica",
  gt: "Guatemala",
  guatemala: "Guatemala",
  do: "Republica Dominicana",
  us: "Estados Unidos",
  usa: "Estados Unidos",
  "united states": "Estados Unidos",
  "estados unidos": "Estados Unidos",
  es: "España",
  espana: "España",
  spain: "España",
  pt: "Portugal",
  portugal: "Portugal",
  br: "Brasil",
  brasil: "Brasil",
  brazil: "Brasil",
  uy: "Uruguay",
  bo: "Bolivia",
  py: "Paraguay",
  ve: "Venezuela",
};

export function normalizeCountry(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const key = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (!key) return null;
  return COUNTRY_ALIASES[key] ?? titleCase(raw.trim());
}

export function titleCase(raw: string): string {
  return raw
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(" ")
    .replace(/(^|\s)(de|del|la|las|los|y|en|a)(\s)/g, (m) => m.toLowerCase());
}

/** Nombre de persona: "JUAN PEREZ" y "juan perez" quedan igual. */
export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  const value = raw.trim().replace(/\s+/g, " ");
  if (!value) return "";
  const hasLower = /[a-z]/.test(value);
  const hasUpper = /[A-Z]/.test(value);
  // Si viene TODO EN MAYUSCULAS o todo en minusculas, se corrige.
  if (!hasLower || !hasUpper) return titleCase(value);
  return value;
}

/** Llave para comparar nombres de empresa: quita S.A.S., LTDA, puntuacion. */
export function companyKey(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\b(s\.?a\.?s\.?|s\.?a\.?|ltda\.?|sas|inc\.?|llc|corp\.?|s\.?l\.?|cia\.?|and|y)\b/g, " ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function normalizeSegment(raw: string | null | undefined): "b2b" | "b2c" | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  if (["b2b", "empresa", "corporativo", "corporate", "company"].includes(v)) return "b2b";
  if (["b2c", "persona", "individual", "particular", "personal"].includes(v)) return "b2c";
  return null;
}
