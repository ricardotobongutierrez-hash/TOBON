import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { ingestWhatsApp, type WhatsAppEvent } from "@/lib/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Entrada del agente de WhatsApp.
 *
 * Se protege con una clave compartida (CRM_INGEST_SECRET). Si el agente manda la
 * firma HMAC en la cabecera x-jit-firma se verifica; si manda la clave directa en
 * x-jit-clave tambien sirve, que es lo mas simple de implementar desde el agente.
 *
 * Sin la variable configurada el endpoint responde 503 y no procesa nada: es
 * preferible a quedar abierto a cualquiera que conozca la URL.
 */
function authorize(request: Request, raw: string): { ok: boolean; reason?: string } {
  const secret = process.env.CRM_INGEST_SECRET;
  if (!secret) {
    return { ok: false, reason: "CRM_INGEST_SECRET no está configurado en el servidor" };
  }

  const key = request.headers.get("x-jit-clave");
  if (key) {
    const a = Buffer.from(key);
    const b = Buffer.from(secret);
    if (a.length === b.length && timingSafeEqual(a, b)) return { ok: true };
    return { ok: false, reason: "La clave no coincide" };
  }

  const signature = request.headers.get("x-jit-firma");
  if (signature) {
    const expected = createHmac("sha256", secret).update(raw).digest("hex");
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return { ok: true };
    return { ok: false, reason: "La firma no coincide" };
  }

  return { ok: false, reason: "Falta la cabecera x-jit-clave o x-jit-firma" };
}

export async function POST(request: Request) {
  const raw = await request.text();

  const auth = authorize(request, raw);
  if (!auth.ok) {
    const status = auth.reason?.includes("no está configurado") ? 503 : 401;
    return NextResponse.json({ error: auth.reason }, { status });
  }

  let body: WhatsAppEvent;
  try {
    body = JSON.parse(raw) as WhatsAppEvent;
  } catch {
    return NextResponse.json({ error: "El cuerpo no es JSON valido" }, { status: 400 });
  }

  if (!body.telefono) {
    return NextResponse.json({ error: "Falta el campo teléfono" }, { status: 400 });
  }

  try {
    const result = await ingestWhatsApp(body);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[ingesta whatsapp]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo procesar el evento" },
      { status: 500 },
    );
  }
}

/** Chequeo de salud, para que el agente sepa si la puerta esta abierta. */
export async function GET() {
  return NextResponse.json({
    servicio: "ingesta-whatsapp",
    configurado: Boolean(process.env.CRM_INGEST_SECRET),
    campos: {
      obligatorio: ["telefono"],
      opcionales: [
        "idExterno",
        "nombre",
        "mensaje",
        "direccion",
        "fecha",
        "correo",
        "empresa",
        "cargo",
        "ciudad",
        "pais",
        "segmento",
        "producto",
        "fuente",
        "campana",
        "urgencia",
        "presupuesto",
        "resumen",
        "siguientePaso",
        "fechaSiguientePaso",
        "escalar",
        "motivoEscalamiento",
      ],
    },
  });
}
