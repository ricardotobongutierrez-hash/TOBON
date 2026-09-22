import "server-only";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * El logo oficial no se redibuja ni se reinterpreta. Si el archivo esta en
 * public/marca/, la aplicacion lo usa tal cual. Mientras no este, se muestra el
 * nombre de la firma compuesto en tipografia, que no es un logo inventado.
 *
 * Para poner el oficial: copiar el SVG (o PNG con fondo transparente) a
 * public/marca/logo.svg y recargar. No hay que tocar codigo.
 */
const CANDIDATES = ["logo.svg", "logo.png", "logo.webp"];

let cached: string | null | undefined;

export function logoAsset(): string | null {
  if (cached !== undefined) return cached;
  const dir = join(process.cwd(), "public", "marca");
  for (const file of CANDIDATES) {
    if (existsSync(join(dir, file))) {
      cached = `/marca/${file}`;
      return cached;
    }
  }
  cached = null;
  return cached;
}
