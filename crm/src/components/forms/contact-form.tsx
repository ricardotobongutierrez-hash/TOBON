"use client";

import { useState } from "react";
import { CONTACT_STATUSES, CONTACT_STATUS_LABEL, SEGMENTS, SEGMENT_LABEL } from "@/db/enums";
import { createContact, updateContact } from "@/server/actions/contacts";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FieldGrid, Input, Select, Textarea } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useSubmit } from "@/lib/use-submit";
import type { Refs } from "@/server/queries/refs";
import type { Pickers } from "@/server/queries/refs";

export type ContactDefaults = {
  id?: string;
  fullName?: string;
  phone?: string | null;
  email?: string | null;
  companyId?: string | null;
  position?: string | null;
  city?: string | null;
  country?: string | null;
  segment?: string;
  sourceId?: string | null;
  campaignId?: string | null;
  interestProductId?: string | null;
  responsibleId?: string | null;
  status?: string;
  notes?: string | null;
  tags?: string;
};

/**
 * Crear un contacto tiene que tomar menos de 30 segundos: solo el nombre es
 * obligatorio. Lo demas queda a la vista pero opcional, y los campos de
 * atribucion se despliegan solo si se necesitan.
 */
export function ContactForm({
  refs,
  pickers,
  defaults,
  onDone,
  formId,
}: {
  refs: Refs;
  pickers: Pickers;
  defaults?: ContactDefaults;
  onDone?: (id?: string) => void;
  formId?: string;
}) {
  const editing = Boolean(defaults?.id);
  const [segment, setSegment] = useState(defaults?.segment ?? "b2c");
  const [showMore, setShowMore] = useState(false);
  const [force, setForce] = useState(false);

  const { submit, pending, error, field } = useSubmit({
    action: (fd) => (editing ? updateContact(defaults!.id!, fd) : createContact(fd)),
    success: editing ? "Contacto actualizado" : "Contacto creado",
    onDone: (data) => onDone?.((data as { id: string } | undefined)?.id),
  });

  return (
    <form id={formId} onSubmit={submit} className="space-y-4">
      <FormError message={error} />
      {field === "duplicado" ? (
        <Checkbox
          label="Sí, crear igual"
          hint="Ya existe alguien con ese correo o teléfono. Marca esto solo si de verdad son personas distintas."
          checked={force}
          onChange={(e) => setForce(e.target.checked)}
        />
      ) : null}
      <input type="hidden" name="forzarDuplicado" value={force ? "si" : "no"} />

      <Field label="Nombre completo" htmlFor="fullName" required>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={defaults?.fullName}
          required
          autoFocus={!editing}
          placeholder="Juan Pérez"
        />
      </Field>

      <FieldGrid>
        <Field label="WhatsApp o celular" htmlFor="phone" hint="Si no pones indicativo se asume Colombia.">
          <Input id="phone" name="phone" type="tel" defaultValue={defaults?.phone ?? ""} placeholder="321 746 7350" />
        </Field>
        <Field label="Correo" htmlFor="email">
          <Input id="email" name="email" type="email" defaultValue={defaults?.email ?? ""} placeholder="juan@empresa.com" />
        </Field>
      </FieldGrid>

      <FieldGrid>
        <Field label="Tipo" htmlFor="segment">
          <Select id="segment" name="segment" value={segment} onChange={(e) => setSegment(e.target.value)}>
            {SEGMENTS.map((s) => (
              <option key={s} value={s}>
                {SEGMENT_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
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
      </FieldGrid>

      <FieldGrid>
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
        <Field label="Cargo" htmlFor="position">
          <Input id="position" name="position" defaultValue={defaults?.position ?? ""} placeholder="Gerente Comercial" />
        </Field>
      </FieldGrid>

      {segment === "b2b" ? (
        <Field
          label="O escribe una empresa nueva"
          htmlFor="newCompanyName"
          hint="Si la empresa no está en la lista, se crea automáticamente."
        >
          <Input id="newCompanyName" name="newCompanyName" placeholder="Dorex Cargo S.A.S." />
        </Field>
      ) : (
        <input type="hidden" name="newCompanyName" value="" />
      )}

      <FieldGrid>
        <Field label="Interesado en" htmlFor="interestProductId">
          <Select id="interestProductId" name="interestProductId" defaultValue={defaults?.interestProductId ?? ""}>
            <option value="">Sin definir</option>
            {refs.products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Estado" htmlFor="status">
          <Select id="status" name="status" defaultValue={defaults?.status ?? "nuevo"}>
            {CONTACT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {CONTACT_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
      </FieldGrid>

      <button
        type="button"
        onClick={() => setShowMore((v) => !v)}
        className="text-[13px] font-medium text-brand hover:text-brand-dark"
      >
        {showMore ? "Ocultar" : "Agregar"} origen, ubicacion y etiquetas
      </button>

      {showMore ? (
        <div className="space-y-4 rounded-md border border-line-soft bg-canvas p-4">
          <FieldGrid>
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
          </FieldGrid>
          <FieldGrid>
            <Field label="Ciudad" htmlFor="city">
              <Input id="city" name="city" defaultValue={defaults?.city ?? ""} placeholder="Medellín" />
            </Field>
            <Field label="País" htmlFor="country">
              <Input id="country" name="country" defaultValue={defaults?.country ?? ""} placeholder="Colombia" />
            </Field>
          </FieldGrid>
          <Field label="Etiquetas" htmlFor="tags" hint="Separalas con comas.">
            <Input id="tags" name="tags" defaultValue={defaults?.tags ?? ""} placeholder="compras, alta prioridad" />
          </Field>
        </div>
      ) : (
        <>
          <input type="hidden" name="sourceId" value={defaults?.sourceId ?? ""} />
          <input type="hidden" name="campaignId" value={defaults?.campaignId ?? ""} />
          <input type="hidden" name="city" value={defaults?.city ?? ""} />
          <input type="hidden" name="country" value={defaults?.country ?? ""} />
          <input type="hidden" name="tags" value={defaults?.tags ?? ""} />
        </>
      )}

      <Field label="Notas" htmlFor="notes">
        <Textarea id="notes" name="notes" defaultValue={defaults?.notes ?? ""} rows={3} placeholder="Que necesita, contexto, siguiente paso acordado." />
      </Field>

      {formId ? null : (
        <div className="flex justify-end gap-2 pt-1">
          <Button type="submit" loading={pending}>
            {editing ? "Guardar cambios" : "Crear contacto"}
          </Button>
        </div>
      )}
    </form>
  );
}
