"use client";

import { saveBusinessSettings } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Field, FieldGrid, Input } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useSubmit } from "@/lib/use-submit";
import type { BusinessSettings } from "@/lib/settings";

export function BusinessForm({ settings }: { settings: BusinessSettings }) {
  const { submit, pending, error } = useSubmit({
    action: saveBusinessSettings,
    success: "Datos del negocio guardados",
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormError message={error} />
      <FieldGrid>
        <Field label="Nombre" htmlFor="name" required>
          <Input id="name" name="name" defaultValue={settings.name} required />
        </Field>
        <Field label="Descriptor" htmlFor="tagline">
          <Input id="tagline" name="tagline" defaultValue={settings.tagline} />
        </Field>
      </FieldGrid>
      <FieldGrid>
        <Field label="Correo" htmlFor="email">
          <Input id="email" name="email" type="email" defaultValue={settings.email} />
        </Field>
        <Field label="WhatsApp comercial" htmlFor="whatsapp">
          <Input id="whatsapp" name="whatsapp" defaultValue={settings.whatsapp} />
        </Field>
      </FieldGrid>
      <FieldGrid>
        <Field label="Sitio web" htmlFor="website">
          <Input id="website" name="website" defaultValue={settings.website} />
        </Field>
        <Field label="Ciudad" htmlFor="city">
          <Input id="city" name="city" defaultValue={settings.city} />
        </Field>
      </FieldGrid>
      <p className="rounded-md border border-line-soft bg-canvas px-3 py-2.5 text-[12px] leading-relaxed text-muted">
        El logo oficial no se edita desde aquí: se reemplaza copiando el archivo en public/marca/logo.svg,
        para no alterar la marca. Las instrucciones están en public/marca/LEEME.txt.
      </p>
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
