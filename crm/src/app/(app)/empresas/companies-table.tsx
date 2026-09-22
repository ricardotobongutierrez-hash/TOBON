"use client";

import Link from "next/link";
import { Building2, ExternalLink, Users } from "lucide-react";
import { PURCHASING_CAPACITY_LABEL, type PurchasingCapacity } from "@/db/enums";
import { Badge } from "@/components/ui/badge";
import { DataTable, Td, Th, Thead, Tr } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import { formatNumber } from "@/lib/money";
import type { CompanyRow } from "@/server/queries/lists";

const CAPACITY_TONE: Record<PurchasingCapacity, "verde" | "azul" | "gris"> = {
  alta: "verde",
  media: "azul",
  baja: "gris",
  "sin-definir": "gris",
};

export function CompaniesTable({ rows }: { rows: CompanyRow[] }) {
  return (
    <>
      <div className="hidden lg:block">
        <DataTable>
          <Thead>
            <tr>
              <Th>Empresa</Th>
              <Th>Sector</Th>
              <Th>Ubicación</Th>
              <Th align="center">Contactos</Th>
              <Th align="center">Negocios abiertos</Th>
              <Th align="right">Valor abierto</Th>
              <Th>Capacidad de compra</Th>
              <Th>Responsable</Th>
            </tr>
          </Thead>
          <tbody>
            {rows.map((row) => (
              <Tr key={row.id}>
                <Td className="max-w-64">
                  <Link href={`/empresas/${row.id}`} className="clip-1 font-medium text-ink hover:text-brand">
                    {row.name}
                  </Link>
                  {row.website ? (
                    <a
                      href={row.website}
                      target="_blank"
                      rel="noreferrer"
                      className="clip-1 inline-flex items-center gap-1 text-[12px] text-muted hover:text-brand"
                    >
                      {row.website.replace(/^https?:\/\//, "")}
                      <ExternalLink className="size-3 shrink-0" aria-hidden />
                    </a>
                  ) : null}
                </Td>
                <Td className="max-w-44">
                  <span className="clip-1 text-muted">{row.industry ?? "—"}</span>
                </Td>
                <Td className="max-w-40">
                  <span className="clip-1 text-muted">
                    {[row.city, row.country].filter(Boolean).join(", ") || "—"}
                  </span>
                </Td>
                <Td align="center">
                  <span className="tnum text-ink">{formatNumber(row.contactCount)}</span>
                </Td>
                <Td align="center">
                  <span className="tnum text-ink">{formatNumber(row.openDeals)}</span>
                </Td>
                <Td align="right">
                  <span className="tnum font-medium text-ink">{formatMoney(row.openValue)}</span>
                </Td>
                <Td>
                  <Badge tone={CAPACITY_TONE[row.purchasingCapacity as PurchasingCapacity]} size="sm" dot>
                    {PURCHASING_CAPACITY_LABEL[row.purchasingCapacity as PurchasingCapacity]}
                  </Badge>
                </Td>
                <Td className="max-w-32">
                  <span className="clip-1 text-muted">{row.responsibleName ?? "Sin asignar"}</span>
                </Td>
              </Tr>
            ))}
          </tbody>
        </DataTable>
      </div>

      <ul className="divide-y divide-line-soft lg:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <Link href={`/empresas/${row.id}`} className="block px-4 py-3.5 active:bg-canvas">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-light text-brand-dark">
                  <Building2 className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="clip-1 text-[15px] font-medium text-ink">{row.name}</p>
                  <p className="clip-1 text-[13px] text-muted">
                    {[row.industry, row.city].filter(Boolean).join(" · ") || "Sin sector registrado"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" aria-hidden />
                      {row.contactCount}
                    </span>
                    {row.openDeals > 0 ? (
                      <span className="tnum font-medium text-ink">{formatMoney(row.openValue)}</span>
                    ) : (
                      <span>Sin negocios abiertos</span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
