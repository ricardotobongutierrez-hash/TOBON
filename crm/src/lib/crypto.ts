import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Cifrado simetrico para los tokens de OAuth. Sin ENCRYPTION_KEY la aplicacion
 * sigue funcionando, pero se niega a guardar un token en claro: mejor que la
 * integracion quede pendiente que dejar credenciales legibles en la base.
 */
const ALGO = "aes-256-gcm";

export const ENCRYPTION_AVAILABLE = Boolean(process.env.ENCRYPTION_KEY);

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY no está configurado: no se pueden guardar tokens.");
  return createHash("sha256").update(raw).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Token cifrado con formato invalido.");
  const decipher = createDecipheriv(ALGO, key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
