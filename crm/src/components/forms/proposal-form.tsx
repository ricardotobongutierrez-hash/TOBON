"use client";

import { useState } from "react";
import { CURRENCIES, PROPOSAL_STATUSES, PROPOSAL_STATUS_LABEL } from "@/db/enums";
import { createProposal } from "@/server/actions/proposals";
import { Button } from "@/components/ui/button";
import { Field, FieldGrid, Input, Select, Textarea } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { FileInput } from "@/components/ui/file-input";
import { useSubmit } from "@/lib/use-submit";
import { addDays, formatDateInput } from "@/lib/dates";
import { toNumber } from "@/lib/money";
import type { Refs } from "@/server/queries/refs";

/** Los estados que tiene sentido elegir al crear. Los demas se cambian despues. */
const CREATABLE = ["borrador", "lista-para-enviar", "enviada"] as const;

export function ProposalForm({
  refs,
  scope,
  defaults,
  onDone,
  formId,
}: {
  refs: Refs;
  scope: { contactId?: string | null; companyId?: string | null; opportunityId?: string | null };
  defaults?: { amount?: string; currency?: string; title?: string; productId?: string | null };
  onDone?: () => void;
  formId?: string;
}) {
  const [amount, setAmount] = useState(defaults?.amount ? String(toNumber(defaults.amount)) : "");
  const { submit, pending, error } = useSubmit({
    action: createProposal,
    success: "Propuesta registrada",
    onDone: () => onDone?.(),
  });

  return (
    <form id={formId} onSubmit={submit} className="space-y-4">
      <FormError message={error} />
      {scope.opportunityId ? <input type="hidden" name="opportunityId" value={scope.opportunityId} /> : null}
      {scope.contactId ? <input type="hidden" name="contactId" value={scope.contactId} /> : null}
      {scope.companyId ? <input type="hidden" name="companyId" value={scope.companyId} /> : null}

      <Field label="Título" htmlFor="title" required>
        <Input id="title" name="title" required autoFocus defaultValue={defaults?.title} placeholder="Bootcamp In-House dos días" />
      </Field>

      <FieldGrid>
        <Field label="Valor" htmlFor="amount" required>
          <Input
            id="amount"
            name="amount"
            required
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="29.000.000"
          />
        </Field>
        <Field label="Moneda" htmlFor="currency">
          <Select id="currency" name="currency" defaultValue={defaults?.currency ?? "COP"}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
      </FieldGrid>

      <FieldGrid>
        <Field label="Estado" htmlFor="status" hint="Al marcarla enviada se agenda el seguimiento.">
          <Select id="status" name="status" defaultValue="borrador">
            {CREATABLE.map((status) => (
              <option key={status} value={status}>
                {PROPOSAL_STATUS_LABEL[status]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Vence el" htmlFor="expiresOn">
          <Input
            id="expiresOn"
            name="expiresOn"
            type="date"
            defaultValue={formatDateInput(addDays(new Date(), 15))}
          />
        </Field>
      </FieldGrid>

      <Field label="Producto" htmlFor="productId">
        <Select id="productId" name="productId" defaultValue={defaults?.productId ?? ""}>
          <option value="">Sin definir</option>
          {refs.products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
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

      <FileInput label="Documento de la propuesta" name="file" hint="PDF, Word o PowerPoint. Hasta 15 MB." />

      <Field label="Notas" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={2} placeholder="Alcance, supuestos, condiciones." />
      </Field>

      {formId ? null : (
        <div className="flex justify-end pt-1">
          <Button type="submit" loading={pending}>
            Registrar propuesta
          </Button>
        </div>
      )}
    </form>
  );
}
