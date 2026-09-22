import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { exchangeCode, fetchUserEmail, gmailConfig, saveAccount } from "@/lib/gmail";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const settings = new URL("/ajustes/correo", base);
  const params = new URL(request.url).searchParams;

  if (params.get("error")) {
    settings.searchParams.set("error", "cancelado");
    return NextResponse.redirect(settings);
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) {
    settings.searchParams.set("error", "respuesta-incompleta");
    return NextResponse.redirect(settings);
  }

  const cfg = gmailConfig();
  if (!cfg.configured) {
    settings.searchParams.set("error", "sin-configurar");
    return NextResponse.redirect(settings);
  }

  try {
    const secret = new TextEncoder().encode(
      process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 24
        ? process.env.AUTH_SECRET
        : "jit-crm-desarrollo-secreto-local-no-produccion",
    );
    const { payload } = await jwtVerify(state, secret);
    if (payload.uso !== "gmail" || typeof payload.sub !== "string") {
      throw new Error("El state no corresponde a esta conexión");
    }

    const tokens = await exchangeCode(code);
    const email = await fetchUserEmail(tokens.access_token);
    await saveAccount(payload.sub, tokens, email);

    await logAudit({
      userId: payload.sub,
      userName: null,
      action: "conectar",
      entityType: "correo",
      entityId: email,
      summary: `Conecto la cuenta de correo ${email}`,
    });

    settings.searchParams.set("conectado", email);
    return NextResponse.redirect(settings);
  } catch (err) {
    console.error("[gmail callback]", err);
    settings.searchParams.set("error", "fallo");
    return NextResponse.redirect(settings);
  }
}
