/**
 * Prueba el filtro que saca cedulas y cuentas de los textos importados.
 *   npx tsx qa/sensibles.ts
 */
import { sinSensibles } from "../scripts/_sensibles";

const casos: [string, string][] = [
  ["Cobrar 3.499.000 del Diplomado", "Cobrar 3.499.000 del Diplomado"],
  ["Pagó COP 980000 por Bold", "Pagó COP 980000 por Bold"],
  ["CC 71.234.567 de Medellín", "CC [número omitido] de Medellín"],
  ["cédula: 1036123456", "cédula: [número omitido]"],
  ["C.C. 1.036.123.456", "C.C. [número omitido]"],
  ["transferencia cuenta 0123456789", "transferencia cuenta [número omitido]"],
  ["Bancolombia ahorros 123-456789-01", "Bancolombia ahorros [número omitido]"],
  ["llamar al 3001234567", "llamar al [número omitido]"],
  ["pantallazo del 2026-05-20", "pantallazo del 2026-05-20"],
  ["Factura FAN757", "Factura FAN757"],
  ["4 cupos por 4.403.000", "4 cupos por 4.403.000"],
];

let fallas = 0;
for (const [entra, espera] of casos) {
  const sale = sinSensibles(entra);
  const ok = sale === espera;
  if (!ok) fallas++;
  console.log(`${ok ? "  OK  " : "  FALLA"} ${entra}  →  ${sale}`);
}
console.log(`\n=== ${casos.length - fallas}/${casos.length} correctos ===`);
process.exit(fallas ? 1 : 0);
