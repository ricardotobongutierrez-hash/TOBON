"use client";

import { TASK_KINDS, TASK_KIND_LABEL, WAITING_FOR } from "@/db/enums";
import { createTask } from "@/server/actions/tasks";
import { Button } from "@/components/ui/button";
import { Field, FieldGrid, Input, Select, Textarea } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useSubmit } from "@/lib/use-submit";
import { addDays, formatDateInput } from "@/lib/dates";
import type { Pickers, Refs } from "@/server/queries/refs";

const WAITING_LABEL: Record<(typeof WAITING_FOR)[number], string> = {
  ninguno: "Nada, depende de nosotros",
  cliente: "Al cliente",
  propuesta: "Respuesta de una propuesta",
  pago: "Un pago",
};

export function TaskForm({
  refs,
  pickers,
  defaults,
  onDone,
  formId,
}: {
  refs: Refs;
  pickers: Pickers;
  defaults?: {
    contactId?: string | null;
    companyId?: string | null;
    opportunityId?: string | null;
    responsibleId?: string | null;
    title?: string;
    kind?: string;
  };
  onDone?: () => void;
  formId?: string;
}) {
  const { submit, pending, error } = useSubmit({
    action: createTask,
    success: "Seguimiento agendado",
    onDone: () => onDone?.(),
  });

  return (
    <form id={formId} onSubmit={submit} className="space-y-4">
      <FormError message={error} />

      <Field label="Qué hay que hacer" htmlFor="title" required>
        <Input id="title" name="title" defaultValue={defaults?.title} required autoFocus placeholder="Llamar para confirmar la fecha" />
      </Field>

      <FieldGrid>
        <Field label="Tipo" htmlFor="kind">
          <Select id="kind" name="kind" defaultValue={defaults?.kind ?? "llamar"}>
            {TASK_KINDS.map((k) => (
              <option key={k} value={k}>
                {TASK_KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Cuando" htmlFor="dueAt" required>
          <Input
            id="dueAt"
            name="dueAt"
            type="datetime-local"
            required
            defaultValue={`${formatDateInput(addDays(new Date(), 1))}T09:00`}
          />
        </Field>
      </FieldGrid>

      {defaults?.opportunityId ? (
        <input type="hidden" name="opportunityId" value={defaults.opportunityId} />
      ) : null}

      {defaults?.contactId ? (
        <input type="hidden" name="contactId" value={defaults.contactId} />
      ) : (
        <Field label="Contacto" htmlFor="contactId">
          <Select id="contactId" name="contactId" defaultValue="">
            <option value="">Sin contacto</option>
            {pickers.contacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {defaults?.companyId ? (
        <input type="hidden" name="companyId" value={defaults.companyId} />
      ) : null}

      <FieldGrid>
        <Field label="Responsable" htmlFor="responsibleId">
          <Select id="responsibleId" name="responsibleId" defaultValue={defaults?.responsibleId ?? ""}>
            <option value="">Yo</option>
            {refs.team.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Estamos esperando" htmlFor="waitingFor">
          <Select id="waitingFor" name="waitingFor" defaultValue="ninguno">
            {WAITING_FOR.map((w) => (
              <option key={w} value={w}>
                {WAITING_LABEL[w]}
              </option>
            ))}
          </Select>
        </Field>
      </FieldGrid>

      <Field label="Notas" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={2} />
      </Field>

      {formId ? null : (
        <div className="flex justify-end pt-1">
          <Button type="submit" loading={pending}>
            Agendar seguimiento
          </Button>
        </div>
      )}
    </form>
  );
}
