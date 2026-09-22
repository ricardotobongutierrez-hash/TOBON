import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

/**
 * Almacenamiento de documentos detras de una interfaz. Hoy hay dos backends:
 *
 *  - disco local (default), para desarrollo y para un despliegue con volumen.
 *  - Supabase Storage, si estan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.
 *
 * Los archivos nunca se sirven directo: pasan por /api/archivos/[id], que valida
 * la sesion antes de devolver el contenido.
 */
export type StorageBackend = "local" | "supabase";

export const STORAGE_BACKEND: StorageBackend =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "local";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "jit-crm";
const LOCAL_ROOT = resolve(process.env.STORAGE_DIR ?? "storage");

export const MAX_FILE_BYTES = Number(process.env.MAX_FILE_BYTES ?? 15 * 1024 * 1024);

export const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/csv",
  "text/plain",
]);

export const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".png", ".jpg", ".jpeg", ".webp", ".csv", ".txt"];

export function isAllowedFile(name: string, mime: string): boolean {
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  return ALLOWED_MIME.has(mime) || ALLOWED_EXTENSIONS.includes(ext);
}

/** Sanea el nombre: nada de rutas relativas ni caracteres raros. */
export function safeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "archivo";
  return base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "archivo";
}

export function buildStorageKey(entityType: string, entityId: string, filename: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${entityType}/${entityId}/${stamp}-${randomUUID().slice(0, 8)}-${safeFilename(filename)}`;
}

export async function putObject(key: string, data: Buffer, contentType: string): Promise<void> {
  if (STORAGE_BACKEND === "supabase") {
    const res = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${key}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: new Uint8Array(data),
    });
    if (!res.ok) throw new Error(`Supabase Storage respondio ${res.status}: ${await res.text()}`);
    return;
  }
  const path = localPath(key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

export async function getObject(key: string): Promise<Buffer> {
  if (STORAGE_BACKEND === "supabase") {
    const res = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${key}`, {
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
    });
    if (!res.ok) throw new Error(`Supabase Storage respondio ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  return readFile(localPath(key));
}

export async function deleteObject(key: string): Promise<void> {
  if (STORAGE_BACKEND === "supabase") {
    await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${key}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
    });
    return;
  }
  await unlink(localPath(key)).catch(() => undefined);
}

/** Impide que una llave con ".." escape del directorio de almacenamiento. */
function localPath(key: string): string {
  const path = resolve(join(LOCAL_ROOT, key));
  if (!path.startsWith(LOCAL_ROOT)) throw new Error("Ruta de archivo no valida");
  return path;
}

export function checksum(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex").slice(0, 16);
}
