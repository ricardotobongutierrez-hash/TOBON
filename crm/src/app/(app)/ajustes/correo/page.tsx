import type { Metadata } from "next";
import { eq, desc, sql } from "drizzle-orm";
import { AlertTriangle, CheckCircle2, ExternalLink, Mail } from "lucide-react";
import { getDb } from "@/db/client";
import { emailAccounts, emailMessages } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { gmailConfig, GMAIL_SCOPES } from "@/lib/gmail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { formatDateTime } from "@/lib/dates";
import { EmailAccountRow } from "./account-row";

export const metadata: Metadata = { title: "Correo" };

const ERRORS: Record<string, string> = {
  "sin-configurar":
    "La integración todavía no está configurada. Hace falta cargar las credenciales de Google Cloud.",
  cancelado: "Cancelaste el permiso en la pantalla de Google. No se conectó nada.",
  "respuesta-incompleta": "Google devolvio una respuesta incompleta. Intenta de nuevo.",
  fallo: "No se pudo completar la conexión. Revisa las credenciales y la URL de redirección.",
};

export default async function EmailSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ conectado?: string; error?: string }>;
}) {
  const me = await requireUser();
  const sp = await searchParams;
  const cfg = gmailConfig();
  const db = await getDb();

  const accounts = await db
    .select({
      a: emailAccounts,
      messages: sql<number>`(
        select count(*)::int from ${emailMessages} where ${emailMessages.accountId} = ${emailAccounts.id}
      )`,
    })
    .from(emailAccounts)
    .where(eq(emailAccounts.userId, me.id))
    .orderBy(desc(emailAccounts.createdAt));

  return (
    <div className="space-y-5">
      {sp.conectado ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-ok/25 bg-ok-soft px-4 py-3">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden />
          <p className="text-[13px] text-ink">
            Cuenta conectada: <span className="break-anywhere font-medium">{sp.conectado}</span>
          </p>
        </div>
      ) : null}

      {sp.error ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-danger/25 bg-danger-soft px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
          <p className="text-[13px] leading-relaxed text-ink">{ERRORS[sp.error] ?? "Algo fallo al conectar."}</p>
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader
          title="Mi correo conectado"
          description="Cada persona conecta su propia cuenta. Nadie ve la bandeja de otro."
        />

        {!cfg.configured ? (
          <div className="px-4 py-4 sm:px-5">
            <div className="rounded-md border border-warn/30 bg-warn-soft px-4 py-3.5">
              <p className="flex items-center gap-2 text-[14px] font-medium text-ink">
                <AlertTriangle className="size-4 shrink-0 text-warn" aria-hidden />
                Integración pendiente de configuración
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink/80">
                El código de la integración esta completo, pero faltan las credenciales de Google Cloud.
                Mientras no esten, el resto del CRM funciona igual.
              </p>
              <p className="mt-2.5 text-[13px] font-medium text-ink">Falta configurar:</p>
              <ul className="mt-1 space-y-0.5">
                {cfg.missing.map((key) => (
                  <li key={key} className="tnum text-[13px] text-ink/80">
                    · <code className="rounded-xs bg-white/70 px-1 py-0.5 text-[12px]">{key}</code>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4">
              <h3 className="text-[14px] font-semibold text-ink">Cómo habilitarla</h3>
              <ol className="mt-2 space-y-2 text-[13px] leading-relaxed text-muted">
                <li>
                  <span className="font-medium text-ink">1.</span> Entra a{" "}
                  <a
                    href="https://console.cloud.google.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-brand hover:text-brand-dark"
                  >
                    Google Cloud Console
                    <ExternalLink className="size-3" aria-hidden />
                  </a>{" "}
                  con la cuenta de Workspace de la firma y crea un proyecto.
                </li>
                <li>
                  <span className="font-medium text-ink">2.</span> En <em>APIs y servicios</em>, habilita
                  la <em>Gmail API</em>.
                </li>
                <li>
                  <span className="font-medium text-ink">3.</span> En <em>Pantalla de consentimiento</em>,
                  elige tipo <em>Interno</em> y agrega estos permisos:
                  <ul className="mt-1 space-y-0.5 pl-4">
                    {GMAIL_SCOPES.map((scope) => (
                      <li key={scope} className="break-anywhere text-[12px]">
                        <code className="rounded-xs bg-canvas px-1 py-0.5">{scope}</code>
                      </li>
                    ))}
                  </ul>
                </li>
                <li>
                  <span className="font-medium text-ink">4.</span> En <em>Credenciales</em>, crea un{" "}
                  <em>ID de cliente OAuth</em> de tipo <em>Aplicación web</em> y registra esta URI de
                  redirección autorizada:
                  <br />
                  <code className="break-anywhere mt-1 inline-block rounded-xs bg-canvas px-1.5 py-1 text-[12px]">
                    {cfg.redirectUri}
                  </code>
                </li>
                <li>
                  <span className="font-medium text-ink">5.</span> Copia el id y el secreto en las
                  variables de entorno <code className="rounded-xs bg-canvas px-1">GOOGLE_CLIENT_ID</code> y{" "}
                  <code className="rounded-xs bg-canvas px-1">GOOGLE_CLIENT_SECRET</code>, y define{" "}
                  <code className="rounded-xs bg-canvas px-1">ENCRYPTION_KEY</code> con una cadena larga y
                  aleatoria: es la que cifra los tokens en la base.
                </li>
                <li>
                  <span className="font-medium text-ink">6.</span> Reinicia la aplicación y vuelve a esta
                  pantalla. El boton de conectar queda activo.
                </li>
              </ol>
              <p className="mt-3 rounded-md border border-line-soft bg-canvas px-3 py-2.5 text-[12px] leading-relaxed text-muted">
                Nunca se guarda la contraseña del correo. Solo el token de acceso y el de refresco,
                cifrados, y se borran al desconectar la cuenta.
              </p>
            </div>
          </div>
        ) : accounts.length === 0 ? (
          <Empty
            icon={Mail}
            title="Todavía no has conectado tu correo"
            message="Al conectarlo, el CRM asocia los correos de tus contactos con su ficha y puedes escribir desde aquí."
            action={
              <Button asChild>
                <a href="/api/correo/google/iniciar">
                  <Mail aria-hidden />
                  Conectar Gmail
                </a>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line-soft">
            {accounts.map((row) => (
              <EmailAccountRow key={row.a.id} account={row.a} messageCount={row.messages} />
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Qué hace la sincronización"
          description="No se copia la bandeja completa."
        />
        <div className="space-y-2 px-4 py-4 text-[13px] leading-relaxed text-muted sm:px-5">
          <p>
            El CRM le pregunta a Gmail solo por los correos que involucran a las direcciones de tus
            contactos, de los últimos seis meses. Lo demas de tu bandeja no se lee ni se guarda.
          </p>
          <p>
            Cada correo encontrado se asocia al contacto por su direccion, y a la empresa cuando el
            contacto tiene una. Aparece en el timeline con asunto, fecha, un extracto y el enlace{" "}
            <span className="font-medium text-ink">Abrir en Gmail</span>.
          </p>
          <p>
            Los correos que envies directamente desde Gmail también se capturan en la siguiente
            sincronización, siempre que sean con un contacto del CRM.
          </p>
        </div>
      </Card>
    </div>
  );
}
