"use client";

import { useState } from "react";
import { COMPANY_SIZES, PURCHASING_CAPACITY, PURCHASING_CAPACITY_LABEL } from "@/db/enums";
import { createCompany, updateCompany } from "@/server/actions/companies";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FieldGrid, Input, Select, Textarea } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useSubmit } from "@/lib/use-submit";
import type { Refs } from "@/server/queries/refs";

const SECTORS = [
  "Logística y transporte",
  "Manufactura",
  "Servicios financieros",
  "Salud y farmacéutica",
  "Tecnología",
  "Retail y consumo",
  "Energía y minas",
  "Construcción e infraestructura",
  "Agroindustria",
  "Educación",
  "Sector público",
  "Servicios profesionales",
  "Telecomunicaciones",
  "Otro",
];

export type CompanyDefaults = {
  id?: string;
  name?: string;
  website?: string | null;
  industry?: string | null;
  country?: string | null;
  city?: string | null;
  size?: string | null;
  responsibleId?: string | null;
  sourceId?: string | null;
  purchasingCapacity?: string;
  notes?: string | null;
};

export function CompanyForm({
  refs,
  defaults,
  onDone,
  formId,
}: {
  refs: Refs;
  defaults?: CompanyDefaults;
  onDone?: (id?: string) => void;
  formId?: string;
}) {
  const editing = Boolean(defaults?.id);
  const [force, setForce] = useState(false);
  const { submit, pending, error, field } = useSubmit({
    action: (fd) => (editing ? updateCompany(defaults!.id!, fd) : createCompany(fd)),
    success: editing ? "Empresa actualizada" : "Empresa creada",
    onDone: (data) => onDone?.((data as { id: string } | undefined)?.id),
  });

  return (
    <form id={formId} onSubmit={submit} className="space-y-4">
      <FormError message={error} />
      {field === "duplicado" ? (
        <Checkbox
          label="Sí, crear igual"
          hint="Ya hay una empresa con un nombre muy parecido o el mismo dominio."
          checked={force}
          onChange={(e) => setForce(e.target.checked)}
        />
      ) : null}
      <input type="hidden" name="forzarDuplicado" value={force ? "si" : "no"} />

      <Field label="Nombre de la empresa" htmlFor="name" required>
        <Input id="name" name="name" defaultValue={defaults?.name} required autoFocus={!editing} placeholder="Dorex Cargo S.A.S." />
      </Field>

      <FieldGrid>
        <Field label="Sitio web" htmlFor="website">
          <Input id="website" name="website" defaultValue={defaults?.website ?? ""} placeholder="dorexcargo.com" />
        </Field>
        <Field label="Sector" htmlFor="industry">
          <Select id="industry" name="industry" defaultValue={defaults?.industry ?? ""}>
            <option value="">Sin definir</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
      </FieldGrid>

      <FieldGrid>
        <Field label="Ciudad" htmlFor="city">
          <Input id="city" name="city" defaultValue={defaults?.city ?? ""} placeholder="Bogotá" />
        </Field>
        <Field label="País" htmlFor="country">
          <Input id="country" name="country" defaultValue={defaults?.country ?? "Colombia"} placeholder="Colombia" />
        </Field>
      </FieldGrid>

      <FieldGrid>
        <Field label="Tamaño" htmlFor="size">
          <Select id="size" name="size" defaultValue={defaults?.size ?? ""}>
            <option value="">Sin definir</option>
            {COMPANY_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} empleados
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Capacidad de compra estimada"
          htmlFor="purchasingCapacity"
          hint="Alimenta el puntaje del lead."
        >
          <Select
            id="purchasingCapacity"
            name="purchasingCapacity"
            defaultValue={defaults?.purchasingCapacity ?? "sin-definir"}
          >
            {PURCHASING_CAPACITY.map((c) => (
              <option key={c} value={c}>
                {PURCHASING_CAPACITY_LABEL[c]}
              </option>
            ))}
          </Select>
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

      <Field label="Notas" htmlFor="notes">
        <Textarea id="notes" name="notes" defaultValue={defaults?.notes ?? ""} rows={3} placeholder="Contexto de la relación, areas involucradas, historia." />
      </Field>

      {formId ? null : (
        <div className="flex justify-end pt-1">
          <Button type="submit" loading={pending}>
            {editing ? "Guardar cambios" : "Crear empresa"}
          </Button>
        </div>
      )}
    </form>
  );
}
