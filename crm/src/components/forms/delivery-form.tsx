"use client";

import { useState } from "react";
import { DELIVERY_STATUSES, DELIVERY_STATUS_LABEL } from "@/db/enums";
import { createDelivery } from "@/server/actions/deliveries";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FieldGrid, Input, Select, Textarea } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useSubmit } from "@/lib/use-submit";
import { addDays, formatDateInput } from "@/lib/dates";
import type { Refs } from "@/server/queries/refs";

export function DeliveryForm({
  refs,
  scope,
  defaults,
  onDone,
  formId,
}: {
  refs: Refs;
  scope: { opportunityId?: string | null; companyId?: string | null; contactId?: string | null };
  defaults?: { title?: string; productId?: string | null };
  onDone?: () => void;
  formId?: string;
}) {
  const [online, setOnline] = useState(false);
  const { submit, pending, error } = useSubmit({
    action: createDelivery,
    success: "Servicio registrado",
    onDone: () => onDone?.(),
  });

  return (
    <form id={formId} onSubmit={submit} className="space-y-4">
      <FormError message={error} />
      {scope.opportunityId ? <input type="hidden" name="opportunityId" value={scope.opportunityId} /> : null}
      {scope.companyId ? <input type="hidden" name="companyId" value={scope.companyId} /> : null}
      {scope.contactId ? <input type="hidden" name="contactId" value={scope.contactId} /> : null}

      <Field label="Qué servicio se entrega" htmlFor="title" required>
        <Input id="title" name="title" required autoFocus defaultValue={defaults?.title} placeholder="Bootcamp In-House, día 1" />
      </Field>

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

      <FieldGrid>
        <Field label="Estado" htmlFor="status">
          <Select id="status" name="status" defaultValue="programado">
            {DELIVERY_STATUSES.map((s) => (
              <option key={s} value={s}>
                {DELIVERY_STATUS_LABEL[s]}
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

      <FieldGrid>
        <Field label="Inicio" htmlFor="scheduledAt">
          <Input
            id="scheduledAt"
            name="scheduledAt"
            type="datetime-local"
            defaultValue={`${formatDateInput(addDays(new Date(), 14))}T08:00`}
          />
        </Field>
        <Field label="Fin" htmlFor="endsAt">
          <Input id="endsAt" name="endsAt" type="datetime-local" />
        </Field>
      </FieldGrid>

      <div className="rounded-md border border-line-soft bg-canvas p-3.5">
        <Checkbox
          label="Es online"
          name="isOnline"
          checked={online}
          onChange={(e) => setOnline(e.target.checked)}
        />
      </div>

      <Field label={online ? "Enlace o plataforma" : "Lugar"} htmlFor="location">
        <Input id="location" name="location" placeholder={online ? "Zoom" : "Sede del cliente, Bogotá"} />
      </Field>

      <Field label="Notas de logística" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={3} placeholder="Número de participantes, sala, materiales, contacto en sitio." />
      </Field>

      {formId ? null : (
        <div className="flex justify-end pt-1">
          <Button type="submit" loading={pending}>
            Guardar servicio
          </Button>
        </div>
      )}
    </form>
  );
}
