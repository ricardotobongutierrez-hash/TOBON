"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { attachments } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_BYTES,
  buildStorageKey,
  deleteObject,
  isAllowedFile,
  putObject,
  safeFilename,
} from "@/lib/storage";
import { explain, fail, ok, type Result } from "./_result";

/** Sube un documento y lo liga a un registro. Devuelve el id del adjunto. */
export async function uploadAttachment(
  entityType: string,
  entityId: string,
  formData: FormData,
): Promise<Result<{ id: string; filename: string }>> {
  try {
    const me = await requireUser();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return fail("Elige un archivo");
    if (file.size > MAX_FILE_BYTES) {
      return fail(`El archivo pesa mas de ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB`);
    }
    if (!isAllowedFile(file.name, file.type)) {
      return fail(`Formato no permitido. Se aceptan: ${ALLOWED_EXTENSIONS.join(", ")}`);
    }

    const filename = safeFilename(file.name);
    const key = buildStorageKey(entityType, entityId, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await putObject(key, buffer, file.type || "application/octet-stream");

    const db = await getDb();
    const [row] = await db
      .insert(attachments)
      .values({
        filename,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        storageKey: key,
        entityType,
        entityId,
        label: (formData.get("label") as string) || null,
        uploadedBy: me.id,
      })
      .returning({ id: attachments.id });

    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "adjuntar",
      entityType,
      entityId,
      summary: `Subio el archivo ${filename}`,
    });

    revalidatePath(`/${entityType}s/${entityId}`);
    return ok({ id: row!.id, filename });
  } catch (err) {
    return fail(explain(err));
  }
}

export async function deleteAttachment(id: string): Promise<Result> {
  try {
    const me = await requireUser();
    const db = await getDb();
    const [row] = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1);
    if (!row) return fail("Ese archivo ya no existe");
    await db.update(attachments).set({ deletedAt: new Date() }).where(eq(attachments.id, id));
    await deleteObject(row.storageKey);
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "eliminar",
      entityType: row.entityType,
      entityId: row.entityId,
      summary: `Elimino el archivo ${row.filename}`,
    });
    revalidatePath(`/${row.entityType}s/${row.entityId}`);
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}
