/**
 * Las fechas del CRM se leen en hora de Colombia sin importar el reloj de la
 * maquina. Se corre con varios TZ para probarlo:
 *   TZ=UTC npx tsx qa/fechas.ts && TZ=America/Bogota npx tsx qa/fechas.ts
 */
import { formatDateInput, formatTime, greeting, isOverdue, isToday, relativeDay, startOfDay, toDate } from "../src/lib/dates";

// 23 sep 2026, 9:30 p. m. en Bogota: en UTC ya es 24 de septiembre.
const nocheBogota = new Date("2026-09-24T02:30:00Z");
const tardeBogota = new Date("2026-09-23T21:00:00Z"); // 4:00 p. m. en Bogota

const casos: [string, unknown, unknown][] = [
  ["Un dia del calendario no se corre", formatDateInput(toDate("2026-09-23")), "2026-09-23"],
  ["A las 9:30 p. m. sigue siendo hoy", isToday(toDate("2026-09-23"), nocheBogota), true],
  ["El 24 es mañana, no hoy", relativeDay("2026-09-24", nocheBogota), "mañana"],
  ["Un pago que vence hoy no esta vencido", startOfDay(toDate("2026-09-23")!) < startOfDay(toDate(nocheBogota)!), false],
  ["Ayer si esta vencido", isOverdue(toDate("2026-09-22"), nocheBogota), true],
  ["Las 5 p. m. se ven como 5 p. m.", formatTime(new Date("2026-09-23T22:00:00Z")).replace(/\s| /g, " ").toLowerCase().startsWith("5:00 p"), true],
  ["A las 4 p. m. es de tarde", greeting(tardeBogota), "Buenas tardes"],
  ["Plural con tilde", relativeDay("2026-09-20", nocheBogota), "hace 3 días"],
];

let fallas = 0;
for (const [nombre, sale, espera] of casos) {
  const ok = sale === espera;
  if (!ok) fallas++;
  console.log(`${ok ? "  OK  " : "  FALLA"} ${nombre}${ok ? "" : `: salió ${JSON.stringify(sale)}, se esperaba ${JSON.stringify(espera)}`}`);
}
console.log(`\n=== ${casos.length - fallas}/${casos.length} correctos (TZ de la máquina: ${process.env.TZ ?? "sin definir"}) ===`);
process.exit(fallas ? 1 : 0);
