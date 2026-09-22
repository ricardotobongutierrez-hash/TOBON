"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CompleteTaskButton } from "@/components/quick/complete-task";
import { DataTable, Td, Th, Thead, Tr } from "@/components/ui/table";
import { formatMoneyShort } from "@/lib/money";
import { formatTime, relativeDay } from "@/lib/dates";
import type { Priority } from "@/server/queries/dashboard";

/**
 * Prioridades de hoy. Cinco columnas y dos acciones: que cliente, que esta
 * pasando, que hacer, cuando y quien. En movil la misma informacion se apila en
 * tarjetas para no encoger una tabla.
 */
export function PrioritiesTable({ rows }: { rows: Priority[] }) {
  return (
    <>
      {/* Escritorio */}
      <div className="hidden lg:block">
        <DataTable>
          <Thead>
            <tr>
              <Th>Cliente</Th>
              <Th>Qué está pasando</Th>
              <Th>Qué hacer</Th>
              <Th>Fecha</Th>
              <Th>Responsable</Th>
              <Th align="right">Acciones</Th>
            </tr>
          </Thead>
          <tbody>
            {rows.map((row) => (
              <Tr key={row.id}>
                <Td className="max-w-52">
                  <Link href={row.clientHref} className="clip-1 font-medium text-ink hover:text-brand">
                    {row.clientName}
                  </Link>
                  {row.amount && Number(row.amount) > 0 ? (
                    <span className="tnum clip-1 text-[12px] text-muted">
                      {formatMoneyShort(row.amount, (row.currency as "COP") ?? "COP")}
                    </span>
                  ) : null}
                </Td>
                <Td className="max-w-48">
                  <span className="clip-2 text-muted">{row.situation}</span>
                </Td>
                <Td className="max-w-56">
                  <span className="clip-2 text-ink">{row.action}</span>
                </Td>
                <Td>
                  <Badge tone={row.urgency === "vencido" ? "rojo" : "ambar"} dot>
                    {row.urgency === "vencido" ? relativeDay(row.dueAt) : `Hoy ${formatTime(row.dueAt)}`}
                  </Badge>
                </Td>
                <Td className="max-w-32">
                  <span className="clip-1 text-muted">{row.responsibleName ?? "Sin asignar"}</span>
                </Td>
                <Td align="right">
                  <div className="flex items-center justify-end gap-1.5">
                    <CompleteTaskButton
                      taskId={row.taskId!}
                      taskTitle={row.action}
                      clientName={row.clientName}
                      variant="outline"
                      label="Hecho"
                    />
                    <Button variant="quiet" size="sm" asChild>
                      <Link href={row.clientHref}>
                        Ver cliente
                        <ArrowUpRight aria-hidden />
                      </Link>
                    </Button>
                  </div>
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      </div>

      {/* Movil y tablet */}
      <ul className="divide-y divide-line-soft lg:hidden">
        {rows.map((row) => (
          <li key={row.id} className="px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={row.clientHref} className="clip-1 text-[15px] font-medium text-ink">
                  {row.clientName}
                </Link>
                <p className="clip-1 text-[12px] text-muted">{row.situation}</p>
              </div>
              <Badge tone={row.urgency === "vencido" ? "rojo" : "ambar"} size="sm" dot>
                {row.urgency === "vencido" ? relativeDay(row.dueAt) : "Hoy"}
              </Badge>
            </div>
            <p className="mt-2 text-[14px] leading-snug text-ink">{row.action}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
              <span>{row.responsibleName ?? "Sin asignar"}</span>
              {row.amount && Number(row.amount) > 0 ? (
                <span className="tnum">{formatMoneyShort(row.amount, (row.currency as "COP") ?? "COP")}</span>
              ) : null}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <CompleteTaskButton
                taskId={row.taskId!}
                taskTitle={row.action}
                clientName={row.clientName}
                variant="outline"
                label="Marcar como realizado"
              />
              <Button variant="quiet" size="sm" asChild>
                <Link href={row.clientHref}>Ver cliente</Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
