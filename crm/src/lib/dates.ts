import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  format,
  isValid,
  parse,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { TZDate } from "@date-fns/tz";

export { addDays, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek };

/**
 * Todas las fechas del CRM se leen en hora de Colombia, en el servidor y en el
 * navegador. Si cada lado usara su propio reloj, el servidor en la nube (UTC)
 * y el navegador de la oficina (Bogota) pintarian horas distintas, y "hoy"
 * cambiaria de dia a las 7 p. m.
 */
export const ZONA_HORARIA = "America/Bogota";

/** La hora actual en Colombia. Usala en lugar de new Date() para calcular "hoy". */
export function ahora(): Date {
  return TZDate.tz(ZONA_HORARIA);
}

export function formatDate(value: Date | string | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, "d MMM yyyy", { locale: es }) : "—";
}

/** "18 SEP" para el timeline. */
export function formatDayMonth(value: Date | string | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, "d MMM", { locale: es }).toUpperCase().replace(".", "") : "—";
}

export function formatDateTime(value: Date | string | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, "d MMM yyyy, h:mm a", { locale: es }) : "—";
}

export function formatTime(value: Date | string | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, "h:mm a", { locale: es }) : "";
}

export function formatDateInput(value: Date | string | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, "yyyy-MM-dd") : "";
}

export function formatDateTimeInput(value: Date | string | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, "yyyy-MM-dd'T'HH:mm") : "";
}

export function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isValid(value) ? new TZDate(value, ZONA_HORARIA) : null;
  // "2026-09-23" es un dia del calendario de Colombia, no una medianoche UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [a, m, d] = value.split("-").map(Number) as [number, number, number];
    return new TZDate(a, m - 1, d, ZONA_HORARIA);
  }
  const iso = parseISO(value);
  if (isValid(iso)) return new TZDate(iso, ZONA_HORARIA);
  const plain = parse(value, "yyyy-MM-dd", ahora());
  return isValid(plain) ? new TZDate(plain, ZONA_HORARIA) : null;
}

/** "hoy", "hace 3 días", "en 2 días". Se lee mas rapido que una fecha. */
export function relativeDay(value: Date | string | null | undefined, now = ahora()): string {
  const d = toDate(value);
  if (!d) return "—";
  const diff = differenceInCalendarDays(startOfDay(d), startOfDay(new TZDate(now, ZONA_HORARIA)));
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  if (diff === -1) return "ayer";
  if (diff < 0) return `hace ${Math.abs(diff)} ${Math.abs(diff) === 1 ? "día" : "días"}`;
  return `en ${diff} ${diff === 1 ? "día" : "días"}`;
}

export function daysBetween(from: Date | string | null | undefined, to: Date = ahora()): number {
  const d = toDate(from);
  if (!d) return 0;
  return differenceInCalendarDays(startOfDay(new TZDate(to, ZONA_HORARIA)), startOfDay(d));
}

export function isOverdue(value: Date | string | null | undefined, now = ahora()): boolean {
  const d = toDate(value);
  if (!d) return false;
  return d.getTime() < now.getTime();
}

export function isToday(value: Date | string | null | undefined, now = ahora()): boolean {
  const d = toDate(value);
  if (!d) return false;
  return differenceInCalendarDays(startOfDay(d), startOfDay(new TZDate(now, ZONA_HORARIA))) === 0;
}

export function greeting(now = ahora()): string {
  const h = new TZDate(now, ZONA_HORARIA).getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function monthLabel(value: Date = ahora()): string {
  return format(new TZDate(value, ZONA_HORARIA), "MMMM yyyy", { locale: es });
}

/** Normaliza fechas de importacion: 2026-09-22, 22/09/2026, 22-09-2026. */
export function parseFlexibleDate(raw: string): Date | null {
  const value = raw.trim();
  if (!value) return null;
  const patterns = ["yyyy-MM-dd", "dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "MM/dd/yyyy", "yyyy/MM/dd"];
  for (const p of patterns) {
    const d = parse(value, p, new Date());
    if (isValid(d)) return d;
  }
  const iso = parseISO(value);
  return isValid(iso) ? iso : null;
}
