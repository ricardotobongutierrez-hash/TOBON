"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataTable, Td, Th, Thead, Tr } from "@/components/ui/table";
import { Empty } from "@/components/ui/empty";
import { formatMoney, formatMoneyShort, plural } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { FinanceBucket } from "@/server/queries/finance";

/**
 * Cada KPI se abre y muestra exactamente que clientes lo componen. Un numero que
 * no se puede desarmar no sirve para llamar a cobrar.
 */
export function BucketGrid({ buckets, initialOpen }: { buckets: FinanceBucket[]; initialOpen?: string }) {
  const [open, setOpen] = useState<string | null>(initialOpen ?? null);
  const current = buckets.find((b) => b.key === open);

  const tones = {
    verde: { value: "text-ok", ring: "border-ok/25" },
    azul: { value: "text-brand-dark", ring: "border-brand/25" },
    ambar: { value: "text-warn", ring: "border-warn/25" },
    rojo: { value: "text-danger", ring: "border-danger/25" },
    gris: { value: "text-ink", ring: "border-line-soft" },
  };

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {buckets.map((bucket) => {
          const tone = tones[bucket.tone];
          const isOpen = open === bucket.key;
          return (
            <button
              key={bucket.key}
              type="button"
              onClick={() => setOpen(isOpen ? null : bucket.key)}
              aria-expanded={isOpen}
              className={cn(
                "rounded-lg border bg-white px-4 py-3.5 text-left shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-raised)]",
                tone.ring,
                isOpen && "ring-2 ring-brand/25",
              )}
            >
              <p className="eyebrow clip-2 min-h-[2.4em]">{bucket.label}</p>
              <p className={cn("tnum mt-1.5 break-anywhere text-[21px] font-semibold leading-tight", tone.value)}>
                {formatMoney(bucket.totalCop)}
              </p>
              <p className="mt-1 flex items-center gap-1 text-[12px] text-muted">
                {bucket.lines.length === 0
                  ? "Nada por ahora"
                  : `${plural(bucket.clients, "cliente")} · ${plural(bucket.lines.length, "registro")}`}
                {bucket.lines.length > 0 ? (
                  isOpen ? (
                    <ChevronDown className="size-3.5" aria-hidden />
                  ) : (
                    <ChevronRight className="size-3.5" aria-hidden />
                  )
                ) : null}
              </p>
            </button>
          );
        })}
      </div>

      {current ? (
        <Card className="anim-in mt-4 overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <h2 className="text-[16px] font-semibold text-ink">{current.label}</h2>
              <p className="mt-0.5 text-[13px] text-muted">{current.help}</p>
            </div>
            <p className="tnum shrink-0 text-[18px] font-semibold text-ink">{formatMoney(current.totalCop)}</p>
          </div>

          {current.lines.length === 0 ? (
            <Empty
              tone="bueno"
              title={`No hay nada en ${current.label.toLowerCase()}`}
              message="Esta parte de la cobranza está al día."
              className="py-8"
            />
          ) : (
            <>
              <div className="hidden lg:block">
                <DataTable>
                  <Thead>
                    <tr>
                      <Th>Cliente</Th>
                      <Th>Negocio</Th>
                      <Th>Referencia</Th>
                      <Th>Fecha</Th>
                      <Th>Estado</Th>
                      <Th>Responsable</Th>
                      <Th align="right">Valor</Th>
                    </tr>
                  </Thead>
                  <tbody>
                    {current.lines.map((line) => (
                      <Tr key={`${current.key}-${line.id}`}>
                        <Td className="max-w-56">
                          {line.clientId ? (
                            <Link
                              href={
                                line.clientKind === "empresa"
                                  ? `/empresas/${line.clientId}`
                                  : `/contactos/${line.clientId}`
                              }
                              className="clip-1 font-medium text-ink hover:text-brand"
                            >
                              {line.clientName}
                            </Link>
                          ) : (
                            <span className="clip-1 text-muted">{line.clientName}</span>
                          )}
                        </Td>
                        <Td className="max-w-52">
                          {line.opportunityId ? (
                            <Link
                              href={`/negocios/${line.opportunityId}`}
                              className="clip-1 inline-flex items-center gap-1 text-muted hover:text-brand"
                            >
                              {line.opportunityName ?? "Ver negocio"}
                              <ExternalLink className="size-3 shrink-0" aria-hidden />
                            </Link>
                          ) : (
                            <span className="text-muted-light">—</span>
                          )}
                        </Td>
                        <Td>
                          <span className="tnum whitespace-nowrap text-[13px] text-muted">
                            {line.reference ?? "—"}
                          </span>
                        </Td>
                        <Td>
                          <span className="whitespace-nowrap text-[13px] text-muted">{formatDate(line.date)}</span>
                        </Td>
                        <Td>
                          <Badge
                            tone={
                              line.status === "pagado"
                                ? "verde"
                                : line.status === "vencido" || line.status === "aceptada"
                                  ? "rojo"
                                  : line.status === "pendiente" || line.status === "parcial"
                                    ? "ambar"
                                    : "azul"
                            }
                            size="sm"
                            dot
                          >
                            {line.status}
                          </Badge>
                        </Td>
                        <Td className="max-w-32">
                          <span className="clip-1 text-muted">{line.responsibleName ?? "Sin asignar"}</span>
                        </Td>
                        <Td align="right">
                          <span className="tnum whitespace-nowrap font-semibold text-ink">
                            {formatMoney(line.amount, line.currency as "COP")}
                          </span>
                          {line.currency !== "COP" ? (
                            <span className="tnum block text-[11px] text-muted">
                              ≈ {formatMoneyShort(line.amountCop)}
                            </span>
                          ) : null}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </DataTable>
              </div>

              <ul className="divide-y divide-line-soft lg:hidden">
                {current.lines.map((line) => (
                  <li key={`m-${current.key}-${line.id}`} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {line.clientId ? (
                          <Link
                            href={
                              line.clientKind === "empresa"
                                ? `/empresas/${line.clientId}`
                                : `/contactos/${line.clientId}`
                            }
                            className="clip-1 text-[14px] font-medium text-ink"
                          >
                            {line.clientName}
                          </Link>
                        ) : (
                          <p className="clip-1 text-[14px] font-medium text-ink">{line.clientName}</p>
                        )}
                        <p className="clip-1 text-[12px] text-muted">
                          {[line.reference, line.opportunityName].filter(Boolean).join(" · ") || "Sin referencia"}
                        </p>
                        <p className="mt-1 text-[12px] text-muted">{formatDate(line.date)}</p>
                      </div>
                      <span className="tnum shrink-0 text-[15px] font-semibold text-ink">
                        {formatMoney(line.amount, line.currency as "COP")}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      ) : (
        <p className="mt-4 text-center text-[13px] text-muted">
          Haz clic en cualquier cifra para ver de que clientes sale.
        </p>
      )}
    </>
  );
}
