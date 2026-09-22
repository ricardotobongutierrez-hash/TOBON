"use client";

import { useState } from "react";
import { CURRENCIES, PAYMENT_METHODS } from "@/db/enums";
import { createPayment } from "@/server/actions/finance";
import { Button } from "@/components/ui/button";
import { Field, FieldGrid, Input, Select, Textarea } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { FileInput } from "@/components/ui/file-input";
import { useSubmit } from "@/lib/use-submit";
import { addDays, formatDateInput } from "@/lib/dates";
import { formatMoney, parseMoneyInput, toNumber } from "@/lib/money";
import { cn } from "@/lib/utils";

const METHOD_LABEL: Record<string, string> = {
  transferencia: "Transferencia",
  bold: "Bold (pasarela)",
  tarjeta: "Tarjeta",
  efectivo: "Efectivo",
  pse: "PSE",
  otro: "Otro",
};

export function PaymentForm({
  scope,
  invoices,
  defaults,
  onDone,
  formId,
}: {
  scope: { contactId?: string | null; companyId?: string | null; opportunityId?: string | null };
  invoices: { id: string; number: string; amount: string; currency: string }[];
  defaults?: { amount?: string; currency?: string };
  onDone?: () => void;
  formId?: string;
}) {
  const [received, setReceived] = useState(true);
  const [amount, setAmount] = useState(defaults?.amount ? String(toNumber(defaults.amount)) : "");
  const [currency, setCurrency] = useState(defaults?.currency ?? "COP");

  const { submit, pending, error } = useSubmit({
    action: createPayment,
    success: received ? "Pago registrado" : "Pago esperado registrado",
    onDone: () => onDone?.(),
  });

  return (
    <form id={formId} onSubmit={submit} className="space-y-4">
      <FormError message={error} />
      {scope.opportunityId ? <input type="hidden" name="opportunityId" value={scope.opportunityId} /> : null}
      {scope.contactId ? <input type="hidden" name="contactId" value={scope.contactId} /> : null}
      {scope.companyId ? <input type="hidden" name="companyId" value={scope.companyId} /> : null}

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ink">Qué estás registrando</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: true, label: "Un pago recibido", hint: "El dinero ya entró" },
            { value: false, label: "Un pago esperado", hint: "Todavía no entra" },
          ].map((option) => (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => setReceived(option.value)}
              aria-pressed={received === option.value}
              className={cn(
                "rounded-md border px-3 py-2.5 text-left transition-colors",
                received === option.value
                  ? "border-brand bg-brand-light"
                  : "border-line bg-white hover:border-muted-light",
              )}
            >
              <span className="block text-[14px] font-medium text-ink">{option.label}</span>
              <span className="block text-[12px] text-muted">{option.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {invoices.length > 0 ? (
        <Field label="Factura asociada" htmlFor="invoiceId">
          <Select id="invoiceId" name="invoiceId" defaultValue={invoices[0]?.id ?? ""}>
            <option value="">Sin factura</option>
            {invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.number} · {formatMoney(invoice.amount, invoice.currency as "COP")}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}

      <FieldGrid>
        <Field label="Valor" htmlFor="amount" required>
          <Input
            id="amount"
            name="amount"
            required
            autoFocus
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="14.500.000"
          />
        </Field>
        <Field label="Moneda" htmlFor="currency">
          <Select id="currency" name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
      </FieldGrid>

      {parseMoneyInput(amount) > 0 ? (
        <p className="tnum rounded-md border border-line-soft bg-canvas px-3 py-2 text-[14px] font-medium text-ink">
          {formatMoney(parseMoneyInput(amount), currency as "COP")}
        </p>
      ) : null}

      {received ? (
        <>
          <FieldGrid>
            <Field label="Fecha del pago" htmlFor="paidOn" required>
              <Input id="paidOn" name="paidOn" type="date" required defaultValue={formatDateInput(new Date())} />
            </Field>
            <Field label="Medio de pago" htmlFor="method">
              <Select id="method" name="method" defaultValue="transferencia">
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABEL[m]}
                  </option>
                ))}
              </Select>
            </Field>
          </FieldGrid>
          <Field label="Referencia" htmlFor="reference" hint="Número de la transferencia o del comprobante.">
            <Input id="reference" name="reference" placeholder="TRF-889120" />
          </Field>
          <FileInput label="Comprobante" name="file" hint="PDF o imagen del soporte." />
        </>
      ) : (
        <Field label="Fecha esperada" htmlFor="expectedOn" required>
          <Input
            id="expectedOn"
            name="expectedOn"
            type="date"
            required
            defaultValue={formatDateInput(addDays(new Date(), 30))}
          />
        </Field>
      )}

      <Field label="Notas" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={2} placeholder="Primera cuota, anticipo, condición acordada." />
      </Field>

      {formId ? null : (
        <div className="flex justify-end pt-1">
          <Button type="submit" loading={pending}>
            Registrar pago
          </Button>
        </div>
      )}
    </form>
  );
}
