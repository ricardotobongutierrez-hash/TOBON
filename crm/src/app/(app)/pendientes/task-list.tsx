"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarClock, Clock, MoreHorizontal, RotateCcw, Trash2, User } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { TASK_KIND_LABEL, type TaskKind } from "@/db/enums";
import { cancelTask, rescheduleTask } from "@/server/actions/tasks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/drawer";
import { Field, Input } from "@/components/ui/field";
import { CompleteTaskButton } from "@/components/quick/complete-task";
import { useRun } from "@/lib/use-submit";
import { formatMoneyShort } from "@/lib/money";
import { addDays, formatDateTime, formatDateTimeInput, isOverdue, relativeDay } from "@/lib/dates";
import type { TaskRow } from "@/server/queries/lists";

/**
 * Cada pendiente dice a quien, que hay que hacer, cuando, quien responde y
 * cuanto vale el negocio. Con tres acciones: hecho, reprogramar, abrir cliente.
 */
export function TaskList({ rows }: { rows: TaskRow[] }) {
  const [rescheduling, setRescheduling] = useState<TaskRow | null>(null);
  const [when, setWhen] = useState("");
  const { run, pending } = useRun();

  function openReschedule(task: TaskRow) {
    setWhen(formatDateTimeInput(task.dueAt ?? addDays(new Date(), 1)));
    setRescheduling(task);
  }

  return (
    <>
      <ul className="divide-y divide-line-soft">
        {rows.map((task) => {
          const client = task.companyName ?? task.contactName ?? task.opportunityName ?? "Sin cliente";
          const href = task.companyId
            ? `/empresas/${task.companyId}`
            : task.contactId
              ? `/contactos/${task.contactId}`
              : task.opportunityId
                ? `/negocios/${task.opportunityId}`
                : null;
          const overdue = isOverdue(task.dueAt);

          return (
            <li key={task.id} className="px-4 py-3.5 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {href ? (
                      <Link
                        href={href}
                        className="clip-1 w-full text-[14px] font-semibold text-ink hover:text-brand sm:w-auto sm:max-w-xs"
                      >
                        {client}
                      </Link>
                    ) : (
                      <span className="text-[14px] font-semibold text-ink">{client}</span>
                    )}
                    <Badge tone={overdue ? "rojo" : "gris"} size="sm" dot>
                      {task.dueAt ? relativeDay(task.dueAt) : "Sin fecha"}
                    </Badge>
                    {task.waitingFor !== "ninguno" ? (
                      <Badge tone="ambar" size="sm">
                        Esperando {task.waitingFor === "cliente" ? "al cliente" : task.waitingFor === "pago" ? "el pago" : "la propuesta"}
                      </Badge>
                    ) : null}
                  </div>

                  <p className="mt-1 break-anywhere text-[14px] leading-snug text-ink">{task.title}</p>

                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="size-3.5" aria-hidden />
                      {formatDateTime(task.dueAt)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <User className="size-3.5" aria-hidden />
                      {task.responsibleName ?? "Sin asignar"}
                    </span>
                    <span>{TASK_KIND_LABEL[task.kind as TaskKind] ?? task.kind}</span>
                    {task.opportunityId && task.opportunityAmount && Number(task.opportunityAmount) > 0 ? (
                      <Link
                        href={`/negocios/${task.opportunityId}`}
                        className="tnum font-medium text-brand hover:text-brand-dark"
                      >
                        {formatMoneyShort(task.opportunityAmount, (task.opportunityCurrency as "COP") ?? "COP")}
                      </Link>
                    ) : null}
                  </p>

                  {task.notes ? (
                    <p className="clip-2 mt-1.5 text-[12px] leading-relaxed text-muted">{task.notes}</p>
                  ) : null}
                </div>

                <div className="no-print flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
                  <CompleteTaskButton
                    taskId={task.id}
                    taskTitle={task.title}
                    clientName={client}
                    variant="primary"
                    label="Hecho"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openReschedule(task)}
                    aria-label={`Reprogramar: ${task.title}`}
                  >
                    <CalendarClock aria-hidden />
                    Reprogramar
                  </Button>
                  {href ? (
                    <Button variant="quiet" size="sm" asChild>
                      <Link href={href}>Abrir cliente</Link>
                    </Button>
                  ) : null}
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <Button variant="quiet" size="icon" aria-label="Más opciones">
                        <MoreHorizontal aria-hidden />
                      </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content
                        align="end"
                        sideOffset={6}
                        className="anim-in z-50 w-52 rounded-lg border border-line-soft bg-white p-1.5 shadow-[var(--shadow-float)]"
                      >
                        <DropdownMenu.Item
                          onSelect={() => void run(() => rescheduleTask(task.id, addDays(new Date(), 1).toISOString()), "Movido a mañana")}
                          className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] text-ink outline-none data-[highlighted]:bg-brand-light"
                        >
                          <RotateCcw className="size-4 text-muted" aria-hidden />
                          Mover a mañana
                        </DropdownMenu.Item>
                        <DropdownMenu.Item
                          onSelect={() => void run(() => rescheduleTask(task.id, addDays(new Date(), 7).toISOString()), "Movido a la próxima semana")}
                          className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] text-ink outline-none data-[highlighted]:bg-brand-light"
                        >
                          <RotateCcw className="size-4 text-muted" aria-hidden />
                          Mover a la próxima semana
                        </DropdownMenu.Item>
                        <DropdownMenu.Separator className="my-1 h-px bg-line-soft" />
                        <DropdownMenu.Item
                          onSelect={() => void run(() => cancelTask(task.id), "Pendiente cancelado")}
                          className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] text-danger outline-none data-[highlighted]:bg-danger-soft"
                        >
                          <Trash2 className="size-4" aria-hidden />
                          Cancelar pendiente
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <Modal
        open={rescheduling !== null}
        onOpenChange={(v) => !v && setRescheduling(null)}
        title="Reprogramar"
        description={rescheduling?.title}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setRescheduling(null)}>
              Cancelar
            </Button>
            <Button
              loading={pending}
              onClick={async () => {
                if (!rescheduling) return;
                await run(() => rescheduleTask(rescheduling.id, when), "Pendiente reprogramado");
                setRescheduling(null);
              }}
            >
              Guardar
            </Button>
          </>
        }
      >
        <Field label="Nueva fecha y hora" htmlFor="nueva-fecha" required>
          <Input id="nueva-fecha" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </Field>
      </Modal>
    </>
  );
}
