"use client";

import { useState } from "react";
import { Paperclip, Trash2, Wallet } from "lucide-react";
import { PAYMENT_METHODS } from "@/db/enums";
import { deletePayment, refundPayment, settlePayment } from "@/server/actions/finance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { Modal } from "@/components/ui/drawer";
import { Field, FieldGrid, Input, Select } from "@/components/ui/field";
import { FileInput } from "@/components/ui/file-input";
import { FormError } from "@/components/ui/form-error";
import { useRun, useSubmit } from "@/lib/use-submit";
import { paymentChip } from "@/lib/status";
import { formatMoney, toNumber } from "@/lib/money";
import { formatDate, formatDateInput, isOverdue } from "@/lib/dates";
import type { Payment } from "@/db/schema";

const METHOD_LABEL: Record<string, string> = {
  transferencia: "Transferencia",
  bold: "Bold (pasarela)",
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
  pse: "PSE",
  otro: "Otro",
};

export function PaymentRow({ payment }: { payment: Payment }) {
  const [settling, setSettling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { run } = useRun();
  const chip = paymentChip(payment.status);

  const { submit, pending, error } = useSubmit({
    action: (fd) => settlePayment(payment.id, fd),
    success: "Pago confirmado",
    onDone: () => setSettling(false),
  });

  const overdue = !payment.paidOn && isOverdue(payment.expectedOn);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="inline-flex items-center gap-1.5 text-[14px] font-medium text-ink">
          <Wallet className="size-3.5 text-muted" aria-hidden />
          {payment.paidOn ? "Pago recibido" : "Pago esperado"}
        </p>
        <p className={`text-[12px] ${overdue ? "font-medium text-danger" : "text-muted"}`}>
          {payment.paidOn
            ? `${formatDate(payment.paidOn)}${payment.method ? ` · ${METHOD_LABEL[payment.method] ?? payment.method}` : ""}`
            : `Esperado el ${formatDate(payment.expectedOn)}`}
          {payment.reference ? ` · ${payment.reference}` : ""}
        </p>
        {payment.notes ? <p className="mt-1 break-anywhere text-[12px] text-muted">{payment.notes}</p> : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Badge tone={chip.tone} size="sm" dot>
          {chip.label}
        </Badge>
        <span className="tnum text-[14px] font-semibold text-ink">
          {formatMoney(payment.amount, payment.currency)}
        </span>
        {payment.receiptAttachmentId ? (
          <Button variant="quiet" size="icon" asChild>
            <a href={`/api/archivos/${payment.receiptAttachmentId}`} target="_blank" rel="noreferrer" title="Ver el comprobante">
              <Paperclip aria-hidden />
              <span className="sr-only">Ver el comprobante</span>
            </a>
          </Button>
        ) : null}
        {!payment.paidOn && payment.status !== "reembolsado" ? (
          <Button variant="outline" size="sm" onClick={() => setSettling(true)}>
            Confirmar pago
          </Button>
        ) : null}
        <Button variant="quiet" size="icon" onClick={() => setDeleting(true)} title="Eliminar este pago">
          <Trash2 aria-hidden />
          <span className="sr-only">Eliminar</span>
        </Button>
      </div>

      <Modal
        open={settling}
        onOpenChange={setSettling}
        title="Confirmar el pago"
        description={`Esperado: ${formatMoney(payment.amount, payment.currency)}. Si entro menos, el saldo queda como un pago pendiente aparte.`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setSettling(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" form={`confirmar-${payment.id}`} loading={pending}>
              Confirmar
            </Button>
          </>
        }
      >
        <form id={`confirmar-${payment.id}`} onSubmit={submit} className="space-y-4">
          <FormError message={error} />
          <Field label="Valor recibido" htmlFor={`monto-${payment.id}`} required>
            <Input
              id={`monto-${payment.id}`}
              name="amount"
              required
              inputMode="numeric"
              defaultValue={String(toNumber(payment.amount))}
            />
          </Field>
          <FieldGrid>
            <Field label="Fecha del pago" htmlFor={`fecha-${payment.id}`} required>
              <Input
                id={`fecha-${payment.id}`}
                name="paidOn"
                type="date"
                required
                defaultValue={formatDateInput(new Date())}
              />
            </Field>
            <Field label="Medio de pago" htmlFor={`medio-${payment.id}`}>
              <Select id={`medio-${payment.id}`} name="method" defaultValue={payment.method ?? "transferencia"}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABEL[m]}
                  </option>
                ))}
              </Select>
            </Field>
          </FieldGrid>
          <Field label="Referencia" htmlFor={`ref-${payment.id}`}>
            <Input id={`ref-${payment.id}`} name="reference" defaultValue={payment.reference ?? ""} />
          </Field>
          <FileInput label="Comprobante" name="file" />
        </form>
      </Modal>

      <Confirm
        open={deleting}
        onOpenChange={setDeleting}
        title="Eliminar este pago"
        description={`Se elimina el registro de ${formatMoney(payment.amount, payment.currency)} y el saldo se recalcula. Queda constancia en el historial.`}
        confirmLabel="Eliminar"
        onConfirm={async () => {
          await run(() => deletePayment(payment.id), "Pago eliminado");
        }}
      />
    </li>
  );
}
