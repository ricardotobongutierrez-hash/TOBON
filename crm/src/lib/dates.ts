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

export { addDays, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek };

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
  if (value instanceof Date) return isValid(value) ? value : null;
  const iso = parseISO(value);
  if (isValid(iso)) return iso;
  const plain = parse(value, "yyyy-MM-dd", new Date());
  return isValid(plain) ? plain : null;
}

/** "hoy", "hace 3 días", "en 2 días". Se lee mas rapido que una fecha. */
export function relativeDay(value: Date | string | null | undefined, now = new Date()): string {
  const d = toDate(value);
  if (!d) return "—";
  const diff = differenceInCalendarDays(startOfDay(d), startOfDay(now));
  if (diff === 0) return "hoy";
  if (diff === 1) return "manana";
  if (diff === -1) return "ayer";
  if (diff < 0) return `hace ${Math.abs(diff)} dias`;
  return `en ${diff} dias`;
}

export function daysBetween(from: Date | string | null | undefined, to: Date = new Date()): number {
  const d = toDate(from);
  if (!d) return 0;
  return differenceInCalendarDays(startOfDay(to), startOfDay(d));
}

export function isOverdue(value: Date | string | null | undefined, now = new Date()): boolean {
  const d = toDate(value);
  if (!d) return false;
  return d.getTime() < now.getTime();
}

export function isToday(value: Date | string | null | undefined, now = new Date()): boolean {
  const d = toDate(value);
  if (!d) return false;
  return differenceInCalendarDays(startOfDay(d), startOfDay(now)) === 0;
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function monthLabel(value: Date = new Date()): string {
  return format(value, "MMMM yyyy", { locale: es });
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
