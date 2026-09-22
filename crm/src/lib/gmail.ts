import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { emailAccounts, emailMessages, emailThreads, interactions } from "@/db/schema";
import { decrypt, encrypt, ENCRYPTION_AVAILABLE } from "./crypto";
import { corporateDomain, normalizeEmail } from "./normalize";

/**
 * Integracion con Google Workspace / Gmail por OAuth 2.0.
 *
 * Nunca se guarda la contrasena del correo: solo el access token y el refresh
 * token, cifrados. Si faltan las credenciales de Google Cloud la aplicacion no
 * se rompe: la pantalla de Ajustes muestra "Integracion pendiente de
 * configuracion" y el resto del CRM sigue igual.
 *
 * Pasos exactos para habilitarla en docs/gmail.md del repositorio.
 */
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/userinfo.email",
];

export type GmailConfigState = {
  configured: boolean;
  missing: string[];
  redirectUri: string;
};

export function gmailConfig(): GmailConfigState {
  const missing: string[] = [];
  if (!process.env.GOOGLE_CLIENT_ID) missing.push("GOOGLE_CLIENT_ID");
  if (!process.env.GOOGLE_CLIENT_SECRET) missing.push("GOOGLE_CLIENT_SECRET");
  if (!ENCRYPTION_AVAILABLE) missing.push("ENCRYPTION_KEY");
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return {
    configured: missing.length === 0,
    missing,
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? `${base}/api/correo/google/callback`,
  };
}

export function authorizeUrl(state: string): string {
  const cfg = gmailConfig();
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    // Fuerza la pantalla de consentimiento para que Google devuelva refresh_token.
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const cfg = gmailConfig();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: cfg.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google respondio ${res.status}: ${await res.text()}`);
  return res.json();
}

async function refresh(accountId: string, refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`No se pudo renovar el token de Google: ${res.status}`);
  const data = (await res.json()) as TokenResponse;
  const db = await getDb();
  await db
    .update(emailAccounts)
    .set({
      accessTokenEnc: encrypt(data.access_token),
      tokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
      status: "conectada",
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(emailAccounts.id, accountId));
  return data.access_token;
}

/** Devuelve un access token vigente, renovandolo si hace falta. */
export async function accessTokenFor(accountId: string): Promise<string> {
  const db = await getDb();
  const [account] = await db.select().from(emailAccounts).where(eq(emailAccounts.id, accountId)).limit(1);
  if (!account) throw new Error("La cuenta de correo no existe.");
  const expiresSoon = !account.tokenExpiresAt || account.tokenExpiresAt.getTime() - Date.now() < 60_000;
  if (expiresSoon) {
    if (!account.refreshTokenEnc) throw new Error("La cuenta necesita reconectarse con Google.");
    return refresh(account.id, decrypt(account.refreshTokenEnc));
  }
  return decrypt(account.accessTokenEnc!);
}

export async function fetchUserEmail(accessToken: string): Promise<string> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("No se pudo leer el correo de la cuenta de Google.");
  const data = (await res.json()) as { email?: string };
  if (!data.email) throw new Error("Google no devolvio un correo.");
  return data.email;
}

export async function saveAccount(userId: string, tokens: TokenResponse, email: string): Promise<void> {
  const db = await getDb();
  const values = {
    userId,
    provider: "gmail" as const,
    email,
    accessTokenEnc: encrypt(tokens.access_token),
    refreshTokenEnc: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
    tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    scope: tokens.scope,
    status: "conectada" as const,
    lastError: null,
    updatedAt: new Date(),
  };
  const [existing] = await db
    .select({ id: emailAccounts.id })
    .from(emailAccounts)
    .where(and(eq(emailAccounts.userId, userId), eq(emailAccounts.email, email)))
    .limit(1);
  if (existing) {
    await db.update(emailAccounts).set(values).where(eq(emailAccounts.id, existing.id));
  } else {
    await db.insert(emailAccounts).values(values);
  }
}

export function gmailThreadUrl(providerThreadId: string): string {
  return `https://mail.google.com/mail/u/0/#all/${providerThreadId}`;
}

// ───────────────── Sincronizacion selectiva ─────────────────

type GmailListItem = { id: string; threadId: string };

/**
 * No se copia la bandeja completa. Se consulta Gmail por los correos que
 * involucran a los contactos del CRM y solo esos se guardan.
 */
export async function syncAccount(accountId: string, options: { maxContacts?: number } = {}) {
  const db = await getDb();
  const [account] = await db.select().from(emailAccounts).where(eq(emailAccounts.id, accountId)).limit(1);
  if (!account) throw new Error("La cuenta de correo no existe.");

  const token = await accessTokenFor(accountId);
  const { contacts } = await import("@/db/schema");
  const { isNotNull, isNull, and: and2, desc } = await import("drizzle-orm");

  const targets = await db
    .select({ id: contacts.id, email: contacts.emailNormalized, companyId: contacts.companyId })
    .from(contacts)
    .where(and2(isNotNull(contacts.emailNormalized), isNull(contacts.deletedAt)))
    .orderBy(desc(contacts.lastInteractionAt))
    .limit(options.maxContacts ?? 60);

  let imported = 0;
  for (const target of targets) {
    if (!target.email) continue;
    const query = `{from:${target.email} to:${target.email}} newer_than:180d`;
    const list = await gmailGet<{ messages?: GmailListItem[] }>(
      token,
      `/messages?maxResults=10&q=${encodeURIComponent(query)}`,
    );
    for (const item of list.messages ?? []) {
      const already = await db
        .select({ id: emailMessages.id })
        .from(emailMessages)
        .where(
          and(eq(emailMessages.accountId, accountId), eq(emailMessages.providerMessageId, item.id)),
        )
        .limit(1);
      if (already.length > 0) continue;
      const stored = await storeMessage(accountId, account.email, token, item, target);
      if (stored) imported += 1;
    }
  }

  await db
    .update(emailAccounts)
    .set({ lastSyncAt: new Date(), status: "conectada", lastError: null })
    .where(eq(emailAccounts.id, accountId));

  return { imported };
}

async function storeMessage(
  accountId: string,
  mailbox: string,
  token: string,
  item: GmailListItem,
  target: { id: string; companyId: string | null },
): Promise<boolean> {
  const db = await getDb();
  const msg = await gmailGet<{
    id: string;
    threadId: string;
    snippet?: string;
    internalDate?: string;
    payload?: { headers?: { name: string; value: string }[] };
  }>(token, `/messages/${item.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date`);

  const headers = new Map((msg.payload?.headers ?? []).map((h) => [h.name.toLowerCase(), h.value]));
  const from = headers.get("from") ?? "";
  const fromEmail = normalizeEmail(from.match(/<(.+?)>/)?.[1] ?? from);
  const direction = fromEmail === normalizeEmail(mailbox) ? "salida" : "entrada";
  const sentAt = msg.internalDate ? new Date(Number(msg.internalDate)) : new Date();
  const subject = headers.get("subject") ?? "(sin asunto)";

  let [thread] = await db
    .select()
    .from(emailThreads)
    .where(and(eq(emailThreads.accountId, accountId), eq(emailThreads.providerThreadId, msg.threadId)))
    .limit(1);
  if (!thread) {
    [thread] = await db
      .insert(emailThreads)
      .values({
        accountId,
        providerThreadId: msg.threadId,
        subject,
        snippet: msg.snippet ?? null,
        contactId: target.id,
        companyId: target.companyId,
        lastMessageAt: sentAt,
        messageCount: 1,
      })
      .returning();
  } else {
    await db
      .update(emailThreads)
      .set({
        lastMessageAt: sentAt,
        snippet: msg.snippet ?? thread.snippet,
        messageCount: thread.messageCount + 1,
      })
      .where(eq(emailThreads.id, thread.id));
  }

  const [interaction] = await db
    .insert(interactions)
    .values({
      kind: "email",
      direction,
      title: direction === "entrada" ? `Correo recibido: ${subject}` : `Correo enviado: ${subject}`,
      body: msg.snippet ?? null,
      occurredAt: sentAt,
      contactId: target.id,
      companyId: target.companyId,
      externalId: `gmail:${accountId}:${msg.id}`,
      externalUrl: gmailThreadUrl(msg.threadId),
    })
    .onConflictDoNothing()
    .returning();

  await db.insert(emailMessages).values({
    threadId: thread!.id,
    accountId,
    providerMessageId: msg.id,
    fromEmail,
    fromName: from.replace(/<.+?>/, "").replace(/"/g, "").trim() || null,
    toEmails: headers.get("to") ?? null,
    ccEmails: headers.get("cc") ?? null,
    subject,
    snippet: msg.snippet ?? null,
    direction,
    sentAt,
    contactId: target.id,
    interactionId: interaction?.id ?? null,
  });

  return true;
}

async function gmailGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Gmail respondio ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Envia un correo desde la cuenta conectada del usuario. */
export async function sendEmail(input: {
  accountId: string;
  to: string;
  subject: string;
  body: string;
  cc?: string;
}): Promise<{ id: string; threadId: string }> {
  const token = await accessTokenFor(input.accountId);
  const lines = [
    `To: ${input.to}`,
    input.cc ? `Cc: ${input.cc}` : null,
    `Subject: ${input.subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
    "",
    input.body,
  ].filter(Boolean);
  const raw = Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) throw new Error(`Gmail no pudo enviar el correo: ${await res.text()}`);
  return res.json();
}

/** Guarda un borrador en Gmail sin enviarlo. */
export async function createDraft(input: {
  accountId: string;
  to: string;
  subject: string;
  body: string;
}): Promise<{ id: string }> {
  const token = await accessTokenFor(input.accountId);
  const raw = Buffer.from(
    [`To: ${input.to}`, `Subject: ${input.subject}`, "Content-Type: text/plain; charset=utf-8", "", input.body].join("\r\n"),
  )
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { raw } }),
  });
  if (!res.ok) throw new Error(`Gmail no pudo crear el borrador: ${await res.text()}`);
  return res.json();
}

export { corporateDomain };
