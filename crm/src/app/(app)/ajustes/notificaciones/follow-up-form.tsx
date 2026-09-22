"use client";

import { saveFollowUpSettings } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Field, FieldGrid, Input } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useSubmit } from "@/lib/use-submit";
import type { FollowUpSettings } from "@/lib/settings";

export function FollowUpForm({ settings }: { settings: FollowUpSettings }) {
  const { submit, pending, error } = useSubmit({
    action: saveFollowUpSettings,
    success: "Reglas actualizadas",
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormError message={error} />
      <FieldGrid>
        <Field
          label="Días para el seguimiento de una propuesta"
          htmlFor="proposalFollowUpDays"
          hint="Al enviar una propuesta se agenda el seguimiento tantos días después."
        >
          <Input
            id="proposalFollowUpDays"
            name="proposalFollowUpDays"
            type="number"
            min={1}
            max={60}
            defaultValue={settings.proposalFollowUpDays}
          />
        </Field>
        <Field
          label="Desde que valor un negocio es de alto valor"
          htmlFor="highValueCop"
          hint="En pesos. Los negocios por encima se marcan en el tablero."
        >
          <Input
            id="highValueCop"
            name="highValueCop"
            inputMode="numeric"
            defaultValue={String(settings.highValueCop)}
          />
        </Field>
      </FieldGrid>
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
