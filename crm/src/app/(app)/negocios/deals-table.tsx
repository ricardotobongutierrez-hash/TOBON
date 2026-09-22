"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable, Td, Th, Thead, Tr } from "@/components/ui/table";
import { billingChip, paymentChip, proposalChip, stageChip } from "@/lib/status";
import { formatMoney } from "@/lib/money";
import { daysBetween, formatDate, isOverdue, relativeDay } from "@/lib/dates";
import type { OpportunityRow } from "@/server/queries/lists";
import type { PipelineStage } from "@/db/schema";

/** Vista de lista del pipeline: la misma informacion, ordenada por valor. */
export function DealsTable({ rows, stages }: { rows: OpportunityRow[]; stages: PipelineStage[] }) {
  return (
    <>
      <div className="hidden lg:block">
        <DataTable>
          <Thead>
            <tr>
              <Th>Negocio</Th>
              <Th>Cliente</Th>
              <Th align="right">Valor</Th>
              <Th>Etapa</Th>
              <Th align="center">Días en etapa</Th>
              <Th>Próxima acción</Th>
              <Th>Propuesta</Th>
              <Th>Pago</Th>
              <Th>Responsable</Th>
            </tr>
          </Thead>
          <tbody>
            {rows.map((row) => {
              const stage = stages.find((s) => s.slug === row.stage);
              const chip = stageChip(stage?.name ?? row.stage, stage?.kind ?? "activa");
              const days = daysBetween(row.stageChangedAt);
              return (
                <Tr key={row.id}>
                  <Td className="max-w-60">
                    <Link href={`/negocios/${row.id}`} className="clip-1 font-medium text-ink hover:text-brand">
                      {row.name}
                    </Link>
                    {row.productName ? (
                      <span className="clip-1 text-[12px] text-muted">{row.productName}</span>
                    ) : null}
                  </Td>
                  <Td className="max-w-44">
                    {row.companyId ? (
                      <Link href={`/empresas/${row.companyId}`} className="clip-1 text-muted hover:text-brand">
                        {row.companyName}
                      </Link>
                    ) : row.contactId ? (
                      <Link href={`/contactos/${row.contactId}`} className="clip-1 text-muted hover:text-brand">
                        {row.contactName}
                      </Link>
                    ) : (
                      <span className="text-muted-light">Sin cliente</span>
                    )}
                  </Td>
                  <Td align="right">
                    <span className="tnum whitespace-nowrap font-medium text-ink">
                      {formatMoney(row.amount, row.currency)}
                    </span>
                    <span className="tnum block text-[11px] text-muted">{row.probability} %</span>
                  </Td>
                  <Td>
                    <Badge tone={chip.tone} dot>
                      {chip.label}
                    </Badge>
                  </Td>
                  <Td align="center">
                    <span
                      className={`tnum ${days >= 30 ? "font-medium text-danger" : days >= 14 ? "font-medium text-warn" : "text-muted"}`}
                    >
                      {days}
                    </span>
                  </Td>
                  <Td className="max-w-48">
                    {row.nextAction ? (
                      <>
                        <span className="clip-1 text-[13px] text-ink">{row.nextAction}</span>
                        <span
                          className={`clip-1 text-[12px] ${isOverdue(row.nextActionDate) ? "font-medium text-danger" : "text-muted"}`}
                        >
                          {relativeDay(row.nextActionDate)}
                        </span>
                      </>
                    ) : (
                      <Badge tone="ambar" size="sm">
                        <AlertTriangle className="size-3" aria-hidden />
                        Sin próxima acción
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    <Badge tone={proposalChip(row.proposalStatus).tone} size="sm">
                      {proposalChip(row.proposalStatus).label}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={paymentChip(row.paymentStatus).tone} size="sm">
                      {paymentChip(row.paymentStatus).label}
                    </Badge>
                  </Td>
                  <Td className="max-w-32">
                    <span className="clip-1 text-muted">{row.responsibleName ?? "Sin asignar"}</span>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </DataTable>
      </div>

      <ul className="divide-y divide-line-soft lg:hidden">
        {rows.map((row) => {
          const stage = stages.find((s) => s.slug === row.stage);
          const chip = stageChip(stage?.name ?? row.stage, stage?.kind ?? "activa");
          return (
            <li key={row.id}>
              <Link href={`/negocios/${row.id}`} className="block px-4 py-3.5 active:bg-canvas">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="clip-1 text-[12px] text-muted">
                      {row.companyName ?? row.contactName ?? "Sin cliente"}
                    </p>
                    <p className="clip-2 text-[15px] font-medium text-ink">{row.name}</p>
                  </div>
                  <span className="tnum shrink-0 text-[15px] font-semibold text-ink">
                    {formatMoney(row.amount, row.currency)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone={chip.tone} size="sm" dot>
                    {chip.label}
                  </Badge>
                  <Badge tone={proposalChip(row.proposalStatus).tone} size="sm">
                    {proposalChip(row.proposalStatus).label}
                  </Badge>
                  <Badge tone={billingChip(row.billingStatus).tone} size="sm">
                    {billingChip(row.billingStatus).label}
                  </Badge>
                  <Badge tone={paymentChip(row.paymentStatus).tone} size="sm">
                    {paymentChip(row.paymentStatus).label}
                  </Badge>
                </div>
                <p className="mt-2 text-[12px] text-muted">
                  {row.nextAction ? (
                    <>
                      <span className={isOverdue(row.nextActionDate) ? "font-medium text-danger" : undefined}>
                        {relativeDay(row.nextActionDate)}
                      </span>
                      {" · "}
                      {row.nextAction}
                    </>
                  ) : (
                    <span className="font-medium text-warn">Sin próxima acción</span>
                  )}
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
