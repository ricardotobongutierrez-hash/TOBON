import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { currentUser } from "@/lib/auth";
import { authorizeUrl, gmailConfig } from "@/lib/gmail";

export const runtime = "nodejs";

/**
 * Arranca el consentimiento de Google. El "state" es un token firmado con el id
 * del usuario: asi al volver se sabe de quien es la cuenta y nadie puede
 * inyectar un callback a nombre de otro.
 */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/ingresar", process.env.APP_URL ?? "http://localhost:3000"));

  const cfg = gmailConfig();
  if (!cfg.configured) {
    const url = new URL("/ajustes/correo", process.env.APP_URL ?? "http://localhost:3000");
    url.searchParams.set("error", "sin-configurar");
    return NextResponse.redirect(url);
  }

  const secret = new TextEncoder().encode(
    process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 24
      ? process.env.AUTH_SECRET
      : "jit-crm-desarrollo-secreto-local-no-produccion",
  );
  const state = await new SignJWT({ sub: user.id, uso: "gmail" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(secret);

  return NextResponse.redirect(authorizeUrl(state));
}
