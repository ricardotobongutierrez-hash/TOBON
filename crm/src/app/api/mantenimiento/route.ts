import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runMaintenance } from "@/lib/automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Barrido de mantenimiento, para colgarlo de un cron.
 *
 * El layout de la aplicación ya lo corre cada diez minutos cuando alguien está
 * adentro. Esto existe para el caso contrario: un lunes a las seis de la mañana,
 * antes de que nadie abra el CRM, los vencimientos ya están al día y el resumen
 * del día arranca con la verdad.
 *
 * Se protege con CRON_SECRET, que es la variable que Vercel manda en la cabecera
 * Authorization de sus crons. Sin la variable responde 503 y no hace nada: un
 * endpoint que escribe en la base no se deja abierto a quien adivine la URL.
 */
function autorizado(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  const a = Buffer.from(token);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handler(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET no está configurado en el servidor" },
      { status: 503 },
    );
  }
  if (!autorizado(request)) {
    return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
  }

  const resumen = await runMaintenance();
  return NextResponse.json({ ok: true, ...resumen });
}

export const GET = handler;
export const POST = handler;
