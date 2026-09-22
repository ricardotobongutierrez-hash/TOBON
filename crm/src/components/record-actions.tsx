"use client";

import { useState } from "react";
import { CalendarPlus, FileText, Mail, MessageSquarePlus, Receipt, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { InteractionForm } from "@/components/forms/interaction-form";
import { TaskForm } from "@/components/forms/task-form";
import { ProposalForm } from "@/components/forms/proposal-form";
import { InvoiceForm } from "@/components/forms/invoice-form";
import { PaymentForm } from "@/components/forms/payment-form";
import type { Pickers, Refs } from "@/server/queries/refs";

type Which = "interaccion" | "seguimiento" | "propuesta" | "factura" | "pago" | null;

/**
 * Las acciones del registro abierto. Se muestran las que tienen sentido en cada
 * pantalla: en un contacto no aparece "registrar pago" si no hay negocio.
 */
export function RecordActions({
  refs,
  pickers,
  scope,
  show = ["interaccion", "seguimiento"],
  defaults,
}: {
  refs: Refs;
  pickers: Pickers;
  scope: { contactId?: string | null; companyId?: string | null; opportunityId?: string | null };
  show?: Exclude<Which, null>[];
  defaults?: {
    amount?: string;
    currency?: string;
    title?: string;
    requiresInvoice?: boolean;
    invoices?: { id: string; number: string; amount: string; currency: string }[];
  };
}) {
  const [open, setOpen] = useState<Which>(null);

  const config: Record<
    Exclude<Which, null>,
    { label: string; icon: typeof Mail; title: string; description: string; width: "md" | "lg" }
  > = {
    interaccion: {
      label: "Registrar seguimiento",
      icon: MessageSquarePlus,
      title: "Registrar lo que paso",
      description: "Una llamada, una reunión, un mensaje o una nota.",
      width: "md",
    },
    seguimiento: {
      label: "Agendar acción",
      icon: CalendarPlus,
      title: "Agendar la próxima acción",
      description: "Qué hay que hacer y cuando.",
      width: "md",
    },
    propuesta: {
      label: "Nueva propuesta",
      icon: FileText,
      title: "Nueva propuesta",
      description: "Puedes adjuntar el PDF ahora o después.",
      width: "lg",
    },
    factura: {
      label: "Registrar factura",
      icon: Receipt,
      title: "Registrar factura",
      description: "Esto es seguimiento comercial, no reemplaza la contabilidad.",
      width: "lg",
    },
    pago: {
      label: "Registrar pago",
      icon: Wallet,
      title: "Registrar pago",
      description: "Un pago recibido o uno esperado a futuro.",
      width: "md",
    },
  };

  return (
    <>
      <div className="no-print flex flex-wrap gap-2">
        {show.map((key, index) => {
          const item = config[key];
          return (
            <Button
              key={key}
              variant={index === 0 ? "primary" : "outline"}
              onClick={() => setOpen(key)}
              size="md"
            >
              <item.icon aria-hidden />
              {item.label}
            </Button>
          );
        })}
      </div>

      {open ? (
        <Drawer
          open
          onOpenChange={(v) => !v && setOpen(null)}
          title={config[open].title}
          description={config[open].description}
          width={config[open].width}
          footer={
            <>
              <Button variant="outline" onClick={() => setOpen(null)}>
                Cancelar
              </Button>
              <Button type="submit" form="registro-form">
                Guardar
              </Button>
            </>
          }
        >
          {open === "interaccion" ? (
            <InteractionForm formId="registro-form" scope={scope} onDone={() => setOpen(null)} />
          ) : null}
          {open === "seguimiento" ? (
            <TaskForm
              formId="registro-form"
              refs={refs}
              pickers={pickers}
              defaults={scope}
              onDone={() => setOpen(null)}
            />
          ) : null}
          {open === "propuesta" ? (
            <ProposalForm
              formId="registro-form"
              refs={refs}
              scope={scope}
              defaults={{ amount: defaults?.amount, currency: defaults?.currency, title: defaults?.title }}
              onDone={() => setOpen(null)}
            />
          ) : null}
          {open === "factura" ? (
            <InvoiceForm
              formId="registro-form"
              refs={refs}
              scope={scope}
              defaults={{ amount: defaults?.amount, currency: defaults?.currency, requiresInvoice: defaults?.requiresInvoice }}
              onDone={() => setOpen(null)}
            />
          ) : null}
          {open === "pago" ? (
            <PaymentForm
              formId="registro-form"
              scope={scope}
              invoices={defaults?.invoices ?? []}
              defaults={{ amount: defaults?.amount, currency: defaults?.currency }}
              onDone={() => setOpen(null)}
            />
          ) : null}
        </Drawer>
      ) : null}
    </>
  );
}
