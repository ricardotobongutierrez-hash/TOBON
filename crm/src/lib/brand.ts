import "server-only";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * El logo oficial no se redibuja ni se reinterpreta: la aplicación usa el
 * archivo tal cual está en public/marca/.
 *
 * Son dos piezas, porque la marca tiene dos versiones y usar la equivocada es
 * peor que no usar ninguna:
 *
 *   logo.svg         texto oscuro, para fondos claros (encabezado móvil)
 *   logo-claro.svg   texto blanco, para fondos oscuros (barra lateral, ingreso)
 *
 * Si falta la versión clara se usa la oscura en todas partes, que se ve mal
 * sobre azul noche pero no rompe nada. Si faltan las dos, se compone el nombre
 * de la firma en tipografía, que no es un logo inventado.
 */
export type BrandAssets = {
  /** Para fondos claros. */
  oscuro: string | null;
  /** Para fondos oscuros. */
  claro: string | null;
};

const CANDIDATOS_OSCURO = ["logo.svg", "logo.png", "logo.webp"];
const CANDIDATOS_CLARO = ["logo-claro.svg", "logo-claro.png", "logo-claro.webp"];

let cache: BrandAssets | undefined;

export function logoAssets(): BrandAssets {
  if (cache !== undefined) return cache;
  const dir = join(process.cwd(), "public", "marca");
  const buscar = (nombres: string[]) => {
    for (const nombre of nombres) {
      if (existsSync(join(dir, nombre))) return `/marca/${nombre}`;
    }
    return null;
  };
  cache = { oscuro: buscar(CANDIDATOS_OSCURO), claro: buscar(CANDIDATOS_CLARO) };
  return cache;
}
