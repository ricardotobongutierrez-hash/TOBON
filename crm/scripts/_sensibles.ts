/** Filtro de datos sensibles para las importaciones. Se prueba en qa/sensibles.ts. */

let digitosOmitidos = 0;

/** Cuantos numeros se han borrado en esta corrida, para el resumen. */
export const numerosOmitidos = () => digitosOmitidos;

/**
 * Borra de un texto libre los numeros de seis o mas digitos: cedulas, cuentas,
 * telefonos sueltos. Se respetan las fechas y las cifras de dinero ("3.499.000",
 * "COP 980000"), salvo que justo antes diga cedula, cuenta o algo parecido,
 * porque una cedula tambien se escribe con puntos. Los FAN son cortos.
 */
export function sinSensibles(texto: string): string {
  return texto.replace(/(?<![A-Za-z0-9])\d[\d .-]{4,}\d(?![A-Za-z0-9])/g, (m: string, offset: number, todo: string) => {
    const digitos = m.replace(/\D/g, "").length;
    if (digitos < 6) return m;
    const limpio = m.trim();
    // Una fecha (2026-05-20, 20-05-2026) no es un dato sensible.
    if (/^\d{4}-\d{1,2}-\d{1,2}$|^\d{1,2}-\d{1,2}-\d{4}$/.test(limpio)) return m;
    const antes = todo.slice(Math.max(0, offset - 24), offset);
    const conPalabraSensible = SENSIBLE_ANTES.test(antes);
    // "3.499.000" o "COP 980000" es plata; se respeta salvo que diga cedula o cuenta.
    const pareceDinero = /^\d{1,3}(\.\d{3})+$/.test(limpio) || /(\$|cop|usd)\s*$/i.test(antes);
    if (pareceDinero && !conPalabraSensible) return m;
    digitosOmitidos++;
    return "[número omitido]";
  });
}

/** Palabras que anuncian un documento o una cuenta justo antes del numero. */
const SENSIBLE_ANTES =
  /(c\.?\s?c\.?|c[eé]dula|documento|identificaci[oó]n|cuenta|cta\.?|ahorros|corriente|nequi|daviplata|tarjeta|pasaporte)[\s:#.no°-]*$/i;
