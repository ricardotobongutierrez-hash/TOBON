"use client";

import { saveFinanceSettings } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Field, FieldGrid, Input } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useSubmit } from "@/lib/use-submit";
import type { FinanceSettings } from "@/lib/settings";

export function FinanceForm({ settings }: { settings: FinanceSettings }) {
  const { submit, pending, error } = useSubmit({
    action: saveFinanceSettings,
    success: "Configuración guardada",
  });

  return (
    <form onSubmit={submit} className="space-y-4">
      <FormError message={error} />

      <FieldGrid>
        <Field
          label="Tasa de referencia del dólar"
          htmlFor="usdRate"
          hint="Solo para poder sumar pesos y dólares en un total. No es una tasa contable."
        >
          <Input id="usdRate" name="usdRate" type="number" min={1} step="1" defaultValue={settings.usdRate} />
        </Field>
        <Field
          label="IVA"
          htmlFor="ivaRate"
          hint="En porcentaje. Se cobra solo a quien necesita factura electrónica."
        >
          <Input id="ivaRate" name="ivaRate" type="number" min={0} max={100} step="1" defaultValue={settings.ivaRate} />
        </Field>
      </FieldGrid>

      <Field
        label="Plazo de pago por defecto"
        htmlFor="defaultPaymentTermDays"
        hint="Días entre la emisión y el vencimiento de una factura nueva."
      >
        <Input
          id="defaultPaymentTermDays"
          name="defaultPaymentTermDays"
          type="number"
          min={0}
          max={180}
          defaultValue={settings.defaultPaymentTermDays}
        />
      </Field>

      <FieldGrid>
        <Field label="Prefijo de facturas" htmlFor="invoicePrefix" hint="Se numeran como FV-2026-001.">
          <Input id="invoicePrefix" name="invoicePrefix" defaultValue={settings.invoicePrefix} maxLength={6} />
        </Field>
        <Field label="Prefijo de propuestas" htmlFor="proposalPrefix" hint="Se numeran como P-2026-001.">
          <Input id="proposalPrefix" name="proposalPrefix" defaultValue={settings.proposalPrefix} maxLength={6} />
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
