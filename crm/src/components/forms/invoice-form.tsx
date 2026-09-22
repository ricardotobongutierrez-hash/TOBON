"use client";

import { useState } from "react";
import { BILLING_STATUSES, BILLING_STATUS_LABEL, CURRENCIES } from "@/db/enums";
import { createInvoice } from "@/server/actions/finance";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FieldGrid, Input, Select, Textarea } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { FileInput } from "@/components/ui/file-input";
import { useSubmit } from "@/lib/use-submit";
import { addDays, formatDateInput } from "@/lib/dates";
import { formatMoney, parseMoneyInput, toNumber } from "@/lib/money";
import type { Refs } from "@/server/queries/refs";

const CREATABLE = ["pendiente", "emitida", "enviada"] as const;

export function InvoiceForm({
  refs,
  scope,
  defaults,
  onDone,
  formId,
}: {
  refs: Refs;
  scope: { contactId?: string | null; companyId?: string | null; opportunityId?: string | null };
  defaults?: { amount?: string; currency?: string; requiresInvoice?: boolean };
  onDone?: () => void;
  formId?: string;
}) {
  const [amount, setAmount] = useState(defaults?.amount ? String(toNumber(defaults.amount)) : "");
  const [withIva, setWithIva] = useState(defaults?.requiresInvoice ?? true);
  const [currency, setCurrency] = useState(defaults?.currency ?? "COP");

  const { submit, pending, error } = useSubmit({
    action: createInvoice,
    success: "Factura registrada",
    onDone: () => onDone?.(),
  });

  const base = parseMoneyInput(amount);
  const iva = withIva ? base * 0.19 : 0;

  return (
    <form id={formId} onSubmit={submit} className="space-y-4">
      <FormError message={error} />
      {scope.opportunityId ? <input type="hidden" name="opportunityId" value={scope.opportunityId} /> : null}
      {scope.contactId ? <input type="hidden" name="contactId" value={scope.contactId} /> : null}
      {scope.companyId ? <input type="hidden" name="companyId" value={scope.companyId} /> : null}
      <input type="hidden" name="taxRate" value={withIva ? "19" : "0"} />

      <Field
        label="Número de factura"
        htmlFor="number"
        hint="Si lo dejas vacio se asigna el siguiente consecutivo."
      >
        <Input id="number" name="number" placeholder="FV-2026-004" />
      </Field>

      <FieldGrid>
        <Field label="Valor antes de IVA" htmlFor="amount" required>
          <Input
            id="amount"
            name="amount"
            required
            autoFocus
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="29.000.000"
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

      <div className="rounded-md border border-line-soft bg-canvas p-3.5">
        <Checkbox
          label="Cobrar IVA del 19 %"
          hint="Solo aplica a quien necesita factura electrónica."
          checked={withIva}
          onChange={(e) => setWithIva(e.target.checked)}
        />
        {base > 0 ? (
          <dl className="mt-3 space-y-1 border-t border-line-soft pt-3 text-[13px]">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Base</dt>
              <dd className="tnum text-ink">{formatMoney(base, currency as "COP")}</dd>
            </div>
            {withIva ? (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">IVA 19 %</dt>
                <dd className="tnum text-ink">{formatMoney(iva, currency as "COP")}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3 border-t border-line-soft pt-1">
              <dt className="font-medium text-ink">Total a cobrar</dt>
              <dd className="tnum font-semibold text-ink">{formatMoney(base + iva, currency as "COP")}</dd>
            </div>
          </dl>
        ) : null}
      </div>

      <FieldGrid>
        <Field label="Fecha de emisión" htmlFor="issueDate">
          <Input id="issueDate" name="issueDate" type="date" defaultValue={formatDateInput(new Date())} />
        </Field>
        <Field label="Fecha de vencimiento" htmlFor="dueDate">
          <Input id="dueDate" name="dueDate" type="date" defaultValue={formatDateInput(addDays(new Date(), 30))} />
        </Field>
      </FieldGrid>

      <FieldGrid>
        <Field label="Estado" htmlFor="status" hint="Al emitirla se crea el pago esperado.">
          <Select id="status" name="status" defaultValue="emitida">
            {CREATABLE.map((status) => (
              <option key={status} value={status}>
                {BILLING_STATUS_LABEL[status]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Responsable" htmlFor="responsibleId">
          <Select id="responsibleId" name="responsibleId" defaultValue="">
            <option value="">Yo</option>
            {refs.team.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
      </FieldGrid>

      <FileInput label="Archivo de la factura" name="file" hint="PDF o imagen." />

      <Field label="Notas contables" htmlFor="accountingNotes">
        <Textarea id="accountingNotes" name="accountingNotes" rows={2} placeholder="Orden de compra, centro de costo, condiciones." />
      </Field>

      {formId ? null : (
        <div className="flex justify-end pt-1">
          <Button type="submit" loading={pending}>
            Registrar factura
          </Button>
        </div>
      )}
    </form>
  );
}
