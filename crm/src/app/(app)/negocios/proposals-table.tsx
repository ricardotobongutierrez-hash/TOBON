"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, FileText, Receipt } from "lucide-react";
import { PROPOSAL_STATUSES, PROPOSAL_STATUS_LABEL, type ProposalStatus } from "@/db/enums";
import { setProposalStatus } from "@/server/actions/proposals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { DataTable, Td, Th, Thead, Tr } from "@/components/ui/table";
import { proposalAgeChip, proposalChip } from "@/lib/status";
import { formatMoney } from "@/lib/money";
import { daysBetween, formatDate } from "@/lib/dates";
import { useRun } from "@/lib/use-submit";
import type { ProposalRow } from "@/server/queries/lists";

/**
 * Propuestas con la edad a la vista. Tres, siete y catorce dias sin respuesta
 * son los umbrales que de verdad importan para decidir si hay que llamar.
 */
export function ProposalsTable({ rows }: { rows: ProposalRow[] }) {
  const { run, pending } = useRun();
  const [busy, setBusy] = useState<string | null>(null);

  async function change(id: string, status: ProposalStatus) {
    setBusy(id);
    await run(() => setProposalStatus(id, status), "Propuesta actualizada");
    setBusy(null);
  }

  return (
    <>
      <div className="hidden lg:block">
        <DataTable>
          <Thead>
            <tr>
              <Th>Propuesta</Th>
              <Th>Cliente</Th>
              <Th align="right">Valor</Th>
              <Th>Estado</Th>
              <Th>Sin respuesta</Th>
              <Th>Vence</Th>
              <Th>Responsable</Th>
              <Th align="right">Cambiar estado</Th>
            </tr>
          </Thead>
          <tbody>
            {rows.map((row) => {
              const chip = proposalChip(row.status);
              const age = row.sentAt && !row.respondedAt ? proposalAgeChip(daysBetween(row.sentAt)) : null;
              const acceptedNoInvoice = row.status === "aceptada" && row.hasInvoice === 0;
              return (
                <Tr key={row.id}>
                  <Td className="max-w-56">
                    <span className="tnum block text-[13px] font-medium text-ink">
                      {row.number}
                      {row.currentVersion > 1 ? ` · v${row.currentVersion}` : ""}
                    </span>
                    <span className="clip-1 text-[12px] text-muted">{row.title}</span>
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
                  </Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1">
                      <Badge tone={chip.tone} dot>
                        {chip.label}
                      </Badge>
                      {acceptedNoInvoice ? (
                        <Badge tone="rojo" size="sm">
                          <Receipt className="size-3" aria-hidden />
                          Falta facturar
                        </Badge>
                      ) : null}
                      {row.openFollowUps === 0 && ["enviada", "en-revision"].includes(row.status) ? (
                        <Badge tone="ambar" size="sm">
                          <AlertTriangle className="size-3" aria-hidden />
                          Sin seguimiento
                        </Badge>
                      ) : null}
                    </div>
                  </Td>
                  <Td>
                    {age ? (
                      <Badge tone={age.tone} size="sm">
                        {age.label}
                      </Badge>
                    ) : (
                      <span className="text-[13px] text-muted-light">—</span>
                    )}
                  </Td>
                  <Td>
                    <span className="whitespace-nowrap text-[13px] text-muted">{formatDate(row.expiresOn)}</span>
                  </Td>
                  <Td className="max-w-32">
                    <span className="clip-1 text-muted">{row.responsibleName ?? "Sin asignar"}</span>
                  </Td>
                  <Td align="right">
                    <label>
                      <span className="sr-only">Cambiar el estado de {row.number}</span>
                      <Select
                        value=""
                        disabled={pending && busy === row.id}
                        onChange={(e) => e.target.value && void change(row.id, e.target.value as ProposalStatus)}
                        className="h-8 w-auto min-w-0 text-[12px]"
                      >
                        <option value="">Cambiar a…</option>
                        {PROPOSAL_STATUSES.filter((s) => s !== "sin-propuesta" && s !== row.status).map((s) => (
                          <option key={s} value={s}>
                            {PROPOSAL_STATUS_LABEL[s]}
                          </option>
                        ))}
                      </Select>
                    </label>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </DataTable>
      </div>

      <ul className="divide-y divide-line-soft lg:hidden">
        {rows.map((row) => {
          const chip = proposalChip(row.status);
          const age = row.sentAt && !row.respondedAt ? proposalAgeChip(daysBetween(row.sentAt)) : null;
          return (
            <li key={row.id} className="px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="tnum text-[12px] text-muted">{row.number}</p>
                  <p className="clip-2 text-[15px] font-medium text-ink">{row.title}</p>
                  <p className="clip-1 text-[13px] text-muted">
                    {row.companyName ?? row.contactName ?? "Sin cliente"}
                  </p>
                </div>
                <span className="tnum shrink-0 text-[15px] font-semibold text-ink">
                  {formatMoney(row.amount, row.currency)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={chip.tone} size="sm" dot>
                  {chip.label}
                </Badge>
                {age ? (
                  <Badge tone={age.tone} size="sm">
                    {age.label}
                  </Badge>
                ) : null}
                {row.status === "aceptada" && row.hasInvoice === 0 ? (
                  <Badge tone="rojo" size="sm">
                    Falta facturar
                  </Badge>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {row.opportunityId ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/negocios/${row.opportunityId}`}>Abrir el negocio</Link>
                  </Button>
                ) : null}
                {row.status === "enviada" || row.status === "en-revision" ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => void change(row.id, "aceptada")}>
                      Aceptada
                    </Button>
                    <Button variant="quiet" size="sm" onClick={() => void change(row.id, "rechazada")}>
                      Rechazada
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
