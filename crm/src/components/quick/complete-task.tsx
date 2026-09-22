"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { TASK_KINDS, TASK_KIND_LABEL } from "@/db/enums";
import { completeTask } from "@/server/actions/tasks";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/drawer";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FormError } from "@/components/ui/form-error";
import { useSubmit } from "@/lib/use-submit";
import { addDays, formatDateInput } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** Las opciones de "que sigue", en el orden en que se usan de verdad. */
const NEXT_OPTIONS: { value: string; label: string; days: number }[] = [
  { value: "ninguno", label: "No requiere seguimiento", days: 0 },
  { value: "llamar", label: TASK_KIND_LABEL.llamar, days: 2 },
  { value: "enviar-informacion", label: TASK_KIND_LABEL["enviar-informacion"], days: 1 },
  { value: "enviar-propuesta", label: TASK_KIND_LABEL["enviar-propuesta"], days: 2 },
  { value: "esperar-respuesta", label: TASK_KIND_LABEL["esperar-respuesta"], days: 3 },
  { value: "seguimiento-pago", label: TASK_KIND_LABEL["seguimiento-pago"], days: 5 },
  { value: "agendar-reunion", label: TASK_KIND_LABEL["agendar-reunion"], days: 2 },
  { value: "otro", label: "Otro", days: 3 },
];

/**
 * Cerrar un seguimiento y decidir que sigue, en la misma ventana. Dos clics si
 * no hay nada mas que hacer, tres si hay que agendar algo.
 */
export function CompleteTaskButton({
  taskId,
  taskTitle,
  clientName,
  variant = "primary",
  size = "sm",
  label = "Marcar como realizado",
}: {
  taskId: string;
  taskTitle: string;
  clientName: string;
  variant?: "primary" | "outline" | "ghost" | "quiet";
  size?: "sm" | "md";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState("ninguno");

  const { submit, pending, error } = useSubmit({
    action: (fd) => completeTask(taskId, fd),
    success: "Seguimiento cerrado",
    onDone: () => setOpen(false),
  });

  const chosen = NEXT_OPTIONS.find((o) => o.value === next)!;

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        <Check aria-hidden />
        <span>{label}</span>
      </Button>

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="¿Qué sigue?"
        description={`Estas cerrando: ${taskTitle} · ${clientName}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" form={`completar-${taskId}`} loading={pending}>
              Cerrar seguimiento
            </Button>
          </>
        }
      >
        <form id={`completar-${taskId}`} onSubmit={submit} className="space-y-4">
          <FormError message={error} />

          <Field label="Cómo quedó" htmlFor={`outcome-${taskId}`}>
            <Textarea
              id={`outcome-${taskId}`}
              name="outcome"
              rows={2}
              placeholder="Que respondio, que se acordo."
            />
          </Field>

          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-ink">Siguiente paso</legend>
            <input type="hidden" name="next" value={next} />
            <div className="grid gap-1.5 sm:grid-cols-2">
              {NEXT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setNext(option.value)}
                  aria-pressed={next === option.value}
                  className={cn(
                    "rounded-md border px-3 py-2 text-left text-[13px] font-medium transition-colors",
                    next === option.value
                      ? "border-brand bg-brand-light text-brand-dark"
                      : "border-line bg-white text-muted hover:border-muted-light hover:text-ink",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>

          {next !== "ninguno" ? (
            <div className="space-y-3 rounded-md border border-line-soft bg-canvas p-3.5">
              <Field label="Qué hay que hacer" htmlFor={`nextTitle-${taskId}`}>
                <Input
                  id={`nextTitle-${taskId}`}
                  name="nextTitle"
                  defaultValue={chosen.label}
                  key={next}
                  placeholder={chosen.label}
                />
              </Field>
              <Field label="Cuando" htmlFor={`nextDate-${taskId}`}>
                <Input
                  id={`nextDate-${taskId}`}
                  name="nextDate"
                  type="datetime-local"
                  key={`d-${next}`}
                  defaultValue={`${formatDateInput(addDays(new Date(), chosen.days))}T09:00`}
                />
              </Field>
            </div>
          ) : (
            <p className="rounded-md border border-line-soft bg-canvas px-3 py-2.5 text-[13px] text-muted">
              El pendiente se cierra y no queda nada agendado con este cliente.
            </p>
          )}
        </form>
      </Modal>
    </>
  );
}
