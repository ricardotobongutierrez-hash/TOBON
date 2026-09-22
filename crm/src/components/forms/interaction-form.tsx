"use client";

import { useState } from "react";
import { MessageCircle, Mail, Phone, Users2, StickyNote } from "lucide-react";
import { logInteraction } from "@/server/actions/tasks";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FieldGrid, Input, Select, Textarea } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useSubmit } from "@/lib/use-submit";
import { addDays, formatDateInput, formatDateTimeInput } from "@/lib/dates";
import { cn } from "@/lib/utils";

const KINDS = [
  { value: "llamada", label: "Llamada", icon: Phone },
  { value: "reunion", label: "Reunión", icon: Users2 },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "email", label: "Correo", icon: Mail },
  { value: "nota", label: "Nota", icon: StickyNote },
] as const;

/**
 * Registrar lo que paso y, en el mismo formulario, dejar el siguiente paso.
 * Es el flujo que sostiene la disciplina de seguimiento.
 */
export function InteractionForm({
  scope,
  onDone,
  formId,
}: {
  scope: { contactId?: string | null; companyId?: string | null; opportunityId?: string | null };
  onDone?: () => void;
  formId?: string;
}) {
  const [kind, setKind] = useState<string>("llamada");
  const [withNext, setWithNext] = useState(true);

  const { submit, pending, error } = useSubmit({
    action: logInteraction,
    success: "Quedó registrado",
    onDone: () => onDone?.(),
  });

  return (
    <form id={formId} onSubmit={submit} className="space-y-4">
      <FormError message={error} />
      <input type="hidden" name="kind" value={kind} />
      {scope.contactId ? <input type="hidden" name="contactId" value={scope.contactId} /> : null}
      {scope.companyId ? <input type="hidden" name="companyId" value={scope.companyId} /> : null}
      {scope.opportunityId ? <input type="hidden" name="opportunityId" value={scope.opportunityId} /> : null}

      <fieldset>
        <legend className="mb-2 text-[13px] font-medium text-ink">Qué fue</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => setKind(k.value)}
              aria-pressed={kind === k.value}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-[13px] font-medium transition-colors",
                kind === k.value
                  ? "border-brand bg-brand-light text-brand-dark"
                  : "border-line bg-white text-muted hover:border-muted-light hover:text-ink",
              )}
            >
              <k.icon className="size-4" aria-hidden />
              {k.label}
            </button>
          ))}
        </div>
      </fieldset>

      <Field label="Resumen" htmlFor="title" required>
        <Input
          id="title"
          name="title"
          required
          autoFocus
          placeholder={kind === "nota" ? "Contexto que vale registrar" : "Cliente pidió ajustar el alcance"}
        />
      </Field>

      <Field label="Detalle" htmlFor="body">
        <Textarea id="body" name="body" rows={4} placeholder="Lo que se dijo, lo que quedó acordado, quien decide." />
      </Field>

      <FieldGrid>
        <Field label="Cuando paso" htmlFor="occurredAt">
          <Input id="occurredAt" name="occurredAt" type="datetime-local" defaultValue={formatDateTimeInput(new Date())} />
        </Field>
        <Field label="Quien inicio" htmlFor="direction">
          <Select id="direction" name="direction" defaultValue={kind === "nota" ? "interno" : "salida"}>
            <option value="salida">Nosotros</option>
            <option value="entrada">El cliente</option>
            <option value="interno">Registro interno</option>
          </Select>
        </Field>
      </FieldGrid>

      <div className="rounded-md border border-line-soft bg-canvas p-4">
        <Checkbox
          label="Dejar un siguiente paso"
          hint="Recomendado: si no queda nada agendado, el cliente se enfria."
          checked={withNext}
          onChange={(e) => setWithNext(e.target.checked)}
        />
        {withNext ? (
          <div className="mt-3 space-y-3">
            <Field label="Próxima acción" htmlFor="nextTitle">
              <Input id="nextTitle" name="nextTitle" placeholder="Enviar propuesta ajustada" />
            </Field>
            <Field label="Cuando" htmlFor="nextDate">
              <Input
                id="nextDate"
                name="nextDate"
                type="datetime-local"
                defaultValue={`${formatDateInput(addDays(new Date(), 2))}T09:00`}
              />
            </Field>
          </div>
        ) : null}
      </div>

      {formId ? null : (
        <div className="flex justify-end pt-1">
          <Button type="submit" loading={pending}>
            Guardar
          </Button>
        </div>
      )}
    </form>
  );
}
