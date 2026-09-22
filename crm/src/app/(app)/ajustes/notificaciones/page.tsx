import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { followUpSettings } from "@/lib/settings";
import { Card, CardHeader } from "@/components/ui/card";
import { FollowUpForm } from "./follow-up-form";

export const metadata: Metadata = { title: "Notificaciones" };

export default async function NotificationsPage() {
  await requireRole("admin");
  const cfg = await followUpSettings();

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Reglas de seguimiento"
          description="Cuando el sistema crea un pendiente por su cuenta y cuando marca una alerta."
        />
        <div className="px-4 py-4 sm:px-5">
          <FollowUpForm settings={cfg} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Qué hace el sistema por su cuenta"
          description="Estas reglas corren solas y no se pueden apagar: son las que sostienen el seguimiento."
        />
        <ul className="divide-y divide-line-soft">
          {[
            {
              when: "Se acepta una propuesta",
              then: "El negocio se marca como ganado si seguia activo, y se crea el pendiente de emitir factura cuando el cliente la necesita.",
            },
            {
              when: "Se emite una factura",
              then: "Se registra el pago esperado con la fecha de vencimiento y se agenda el seguimiento de cobro.",
            },
            {
              when: "El pago queda completo",
              then: 'Se crea el registro del servicio y el pendiente "Coordinar servicio".',
            },
            {
              when: "Se envia una propuesta",
              then: "Se agenda el seguimiento según los días configurados arriba.",
            },
            {
              when: "Pasa la fecha de un pago y queda saldo",
              then: "El pago se marca vencido y se crea el pendiente de cobro.",
            },
            {
              when: "Un negocio activo se queda sin próxima acción",
              then: "Aparece marcado en Inicio y en el tablero, con un aviso visible.",
            },
            {
              when: "Un negocio activo no tiene contacto en 3, 7, 14 o 30 días",
              then: "Aparece en la lista de clientes que se están enfriando.",
            },
          ].map((rule) => (
            <li key={rule.when} className="px-4 py-3 sm:px-5">
              <p className="text-[13px] font-medium text-ink">{rule.when}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{rule.then}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Avisos por correo" />
        <div className="px-4 py-4 text-[13px] leading-relaxed text-muted sm:px-5">
          <p>
            El envio de correos de aviso todavia no esta conectado: hace falta configurar un proveedor de
            correo saliente. Las preferencias de cada persona ya se guardan en{" "}
            <span className="font-medium text-ink">Mi cuenta</span> y se respetan cuando se active.
          </p>
          <p className="mt-2">
            Mientras tanto, las alertas viven donde se trabaja: los contadores de la barra lateral, la
            pantalla de Inicio y las secciones de Pendientes. Es a propósito: un CRM que manda diez
            correos al día se termina ignorando.
          </p>
        </div>
      </Card>
    </div>
  );
}
