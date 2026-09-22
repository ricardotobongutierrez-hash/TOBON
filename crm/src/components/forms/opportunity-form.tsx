"use client";

import { useState } from "react";
import { CURRENCIES, SEGMENTS, SEGMENT_LABEL } from "@/db/enums";
import { createOpportunity, updateOpportunity } from "@/server/actions/opportunities";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FieldGrid, Input, Select, Textarea } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useSubmit } from "@/lib/use-submit";
import { formatMoney, parseMoneyInput, toNumber } from "@/lib/money";
import { formatDateInput, addDays } from "@/lib/dates";
import type { Pickers, Refs } from "@/server/queries/refs";

export type OpportunityDefaults = {
  id?: string;
  name?: string;
  contactId?: string | null;
  companyId?: string | null;
  segment?: string;
  productId?: string | null;
  amount?: string;
  currency?: string;
  requiresInvoice?: boolean;
  stage?: string;
  probability?: number;
  expectedCloseOn?: string | null;
  responsibleId?: string | null;
  sourceId?: string | null;
  campaignId?: string | null;
  notes?: string | null;
};

export function OpportunityForm({
  refs,
  pickers,
  defaults,
  onDone,
  formId,
}: {
  refs: Refs;
  pickers: Pickers;
  defaults?: OpportunityDefaults;
  onDone?: (id?: string) => void;
  formId?: string;
}) {
  const editing = Boolean(defaults?.id);
  const [amount, setAmount] = useState(defaults?.amount ? String(toNumber(defaults.amount)) : "");
  const [currency, setCurrency] = useState(defaults?.currency ?? "COP");
  const [requiresInvoice, setRequiresInvoice] = useState(defaults?.requiresInvoice ?? false);
  const [productId, setProductId] = useState(defaults?.productId ?? "");
  const [name, setName] = useState(defaults?.name ?? "");

  const { submit, pending, error } = useSubmit({
    action: (fd) => (editing ? updateOpportunity(defaults!.id!, fd) : createOpportunity(fd)),
    success: editing ? "Negocio actualizado" : "Negocio creado",
    onDone: (data) => onDone?.((data as { id: string } | undefined)?.id),
  });

  /** Al elegir un producto se sugiere el valor y el nombre del negocio. */
  function onProduct(value: string) {
    setProductId(value);
    const product = refs.products.find((p) => p.id === value);
    if (!product) return;
    const price = toNumber(product.promoPrice ?? product.defaultPrice);
    if (price > 0) setAmount(String(price));
    setCurrency(product.currency);
    if (!name.trim()) setName(product.name);
  }

  const parsed = parseMoneyInput(amount);
  const iva = requiresInvoice ? parsed * 0.19 : 0;

  return (
    <form id={formId} onSubmit={submit} className="space-y-4">
      <FormError message={error} />

      <Field label="Nombre del negocio" htmlFor="name" required hint="Cómo lo reconoces en una lista.">
        <Input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus={!editing}
          placeholder="Bootcamp In-House Dorex Cargo"
        />
      </Field>

      <FieldGrid>
        <Field label="Contacto" htmlFor="contactId">
          <Select id="contactId" name="contactId" defaultValue={defaults?.contactId ?? ""}>
            <option value="">Sin contacto</option>
            {pickers.contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Empresa" htmlFor="companyId">
          <Select id="companyId" name="companyId" defaultValue={defaults?.companyId ?? ""}>
            <option value="">Sin empresa</option>
            {pickers.companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      </FieldGrid>

      <FieldGrid>
        <Field label="Producto o servicio" htmlFor="productId">
          <Select id="productId" name="productId" value={productId} onChange={(e) => onProduct(e.target.value)}>
            <option value="">Sin definir</option>
            {refs.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo" htmlFor="segment">
          <Select id="segment" name="segment" defaultValue={defaults?.segment ?? "b2b"}>
            {SEGMENTS.map((s) => (
              <option key={s} value={s}>
                {SEGMENT_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
      </FieldGrid>

      <FieldGrid>
        <Field label="Valor estimado" htmlFor="amount">
          <Input
            id="amount"
            name="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="numeric"
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
          label="El cliente necesita factura electrónica"
          hint="El IVA del 19% se cobra solo en este caso, no por ser empresa."
          name="requiresInvoice"
          checked={requiresInvoice}
          onChange={(e) => setRequiresInvoice(e.target.checked)}
        />
        {parsed > 0 ? (
          <dl className="mt-3 space-y-1 border-t border-line-soft pt-3 text-[13px]">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Valor</dt>
              <dd className="tnum font-medium text-ink">{formatMoney(parsed, currency as "COP")}</dd>
            </div>
            {requiresInvoice ? (
              <>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">IVA 19 %</dt>
                  <dd className="tnum text-ink">{formatMoney(iva, currency as "COP")}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-line-soft pt-1">
                  <dt className="font-medium text-ink">Total con factura</dt>
                  <dd className="tnum font-semibold text-ink">{formatMoney(parsed + iva, currency as "COP")}</dd>
                </div>
              </>
            ) : null}
          </dl>
        ) : null}
      </div>

      <FieldGrid>
        <Field label="Etapa" htmlFor="stage">
          <Select id="stage" name="stage" defaultValue={defaults?.stage ?? refs.stages[0]?.slug}>
            {refs.stages.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Cierre estimado" htmlFor="expectedCloseOn">
          <Input
            id="expectedCloseOn"
            name="expectedCloseOn"
            type="date"
            defaultValue={defaults?.expectedCloseOn ?? ""}
          />
        </Field>
      </FieldGrid>

      <FieldGrid>
        <Field label="Responsable" htmlFor="responsibleId">
          <Select id="responsibleId" name="responsibleId" defaultValue={defaults?.responsibleId ?? ""}>
            <option value="">Sin asignar</option>
            {refs.team.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="De dónde salió" htmlFor="sourceId">
          <Select id="sourceId" name="sourceId" defaultValue={defaults?.sourceId ?? ""}>
            <option value="">Sin definir</option>
            {refs.sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </FieldGrid>

      <Field label="Campaña" htmlFor="campaignId">
        <Select id="campaignId" name="campaignId" defaultValue={defaults?.campaignId ?? ""}>
          <option value="">Sin campaña</option>
          {refs.campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>

      {!editing ? (
        <div className="space-y-4 rounded-md border border-brand/20 bg-brand-light/50 p-4">
          <p className="text-[13px] font-medium text-brand-dark">
            Ningún negocio activo debería quedar sin siguiente acción.
          </p>
          <Field label="Próxima acción" htmlFor="nextActionTitle">
            <Input id="nextActionTitle" name="nextActionTitle" placeholder="Llamar para confirmar alcance" />
          </Field>
          <Field label="Cuando" htmlFor="nextActionDate">
            <Input
              id="nextActionDate"
              name="nextActionDate"
              type="datetime-local"
              defaultValue={`${formatDateInput(addDays(new Date(), 2))}T09:00`}
            />
          </Field>
        </div>
      ) : null}

      <Field label="Notas" htmlFor="notes">
        <Textarea id="notes" name="notes" defaultValue={defaults?.notes ?? ""} rows={3} />
      </Field>

      {formId ? null : (
        <div className="flex justify-end pt-1">
          <Button type="submit" loading={pending}>
            {editing ? "Guardar cambios" : "Crear negocio"}
          </Button>
        </div>
      )}
    </form>
  );
}
