"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { emailAccounts } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { createDraft, sendEmail, syncAccount } from "@/lib/gmail";
import { logEvent } from "@/lib/events";
import { explain, fail, ok, type Result } from "./_result";

export async function disconnectEmail(accountId: string): Promise<Result> {
  try {
    const me = await requireUser();
    const db = await getDb();
    const [account] = await db
      .select()
      .from(emailAccounts)
      .where(and(eq(emailAccounts.id, accountId), eq(emailAccounts.userId, me.id)))
      .limit(1);
    if (!account) return fail("Esa cuenta de correo no es tuya o ya no existe");

    // Los tokens se borran: no se guarda nada que permita volver a entrar.
    await db.delete(emailAccounts).where(eq(emailAccounts.id, accountId));
    await logAudit({
      userId: me.id,
      userName: me.name,
      action: "desconectar",
      entityType: "correo",
      entityId: accountId,
      summary: `Desconecto la cuenta ${account.email}`,
    });
    revalidatePath("/ajustes/correo");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}

export async function syncEmail(accountId: string): Promise<Result<{ imported: number }>> {
  try {
    const me = await requireUser();
    const db = await getDb();
    const [account] = await db
      .select({ id: emailAccounts.id })
      .from(emailAccounts)
      .where(and(eq(emailAccounts.id, accountId), eq(emailAccounts.userId, me.id)))
      .limit(1);
    if (!account) return fail("Esa cuenta de correo no es tuya o ya no existe");

    const result = await syncAccount(accountId);
    revalidatePath("/ajustes/correo");
    revalidatePath("/contactos");
    return ok(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const db = await getDb();
    await db
      .update(emailAccounts)
      .set({ status: "error", lastError: message.slice(0, 400) })
      .where(eq(emailAccounts.id, accountId));
    revalidatePath("/ajustes/correo");
    return fail(`La sincronizacion fallo: ${message}`);
  }
}

/** Envia un correo desde la cuenta conectada y lo registra en el timeline. */
export async function sendEmailFromCrm(formData: FormData): Promise<Result> {
  try {
    const me = await requireUser();
    const db = await getDb();
    const [account] = await db
      .select()
      .from(emailAccounts)
      .where(eq(emailAccounts.userId, me.id))
      .limit(1);
    if (!account) return fail("Primero conecta tu correo en Ajustes, Correo.");

    const to = String(formData.get("to") ?? "").trim();
    const subject = String(formData.get("subject") ?? "").trim();
    const body = String(formData.get("body") ?? "");
    const asDraft = formData.get("draft") === "on";
    if (!to || !subject) return fail("Falta el destinatario o el asunto");

    if (asDraft) {
      await createDraft({ accountId: account.id, to, subject, body });
    } else {
      await sendEmail({ accountId: account.id, to, subject, body });
    }

    await logEvent({
      kind: "email",
      direction: "salida",
      title: asDraft ? `Borrador creado: ${subject}` : `Correo enviado: ${subject}`,
      body,
      contactId: (formData.get("contactId") as string) || null,
      companyId: (formData.get("companyId") as string) || null,
      opportunityId: (formData.get("opportunityId") as string) || null,
      userId: me.id,
      touch: !asDraft,
    });

    revalidatePath("/");
    return ok();
  } catch (err) {
    return fail(explain(err));
  }
}
