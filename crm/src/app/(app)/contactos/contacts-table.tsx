"use client";

import Link from "next/link";
import { useState } from "react";
import { Columns3, MessageCircle, Mail } from "lucide-react";
import { CONTACT_STATUS_LABEL, SEGMENT_LABEL, type ContactStatus, type Segment } from "@/db/enums";
import { contactChip } from "@/lib/status";
import { formatDate, isOverdue, relativeDay } from "@/lib/dates";
import { formatPhone, whatsappLink } from "@/lib/normalize";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, Td, Th, Thead, Tr } from "@/components/ui/table";
import { LeadScore } from "@/components/ui/lead-score";
import { Avatar } from "@/components/ui/avatar";
import type { ContactRow } from "@/server/queries/lists";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

/**
 * Por defecto se muestran solo las columnas que se usan. Las demas se agregan
 * desde "Columnas": una tabla de quince columnas no se lee, se sufre.
 */
const OPTIONAL = [
  { key: "cargo", label: "Cargo" },
  { key: "ciudad", label: "Ciudad" },
  { key: "pais", label: "País" },
  { key: "origen", label: "De dónde salió" },
  { key: "campana", label: "Campaña" },
  { key: "producto", label: "Interesado en" },
  { key: "creado", label: "Fecha de creación" },
] as const;

type OptionalKey = (typeof OPTIONAL)[number]["key"];

export function ContactsTable({ rows }: { rows: ContactRow[] }) {
  const [extra, setExtra] = useState<OptionalKey[]>([]);
  const has = (key: OptionalKey) => extra.includes(key);

  function toggle(key: OptionalKey) {
    setExtra((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));
  }

  return (
    <>
      <div className="no-print flex items-center justify-end border-b border-line-soft px-3 py-2">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <Button variant="quiet" size="sm">
              <Columns3 aria-hidden />
              Columnas
              {extra.length > 0 ? <span className="tnum">({extra.length})</span> : null}
            </Button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="anim-in z-50 w-56 rounded-lg border border-line-soft bg-white p-1.5 shadow-[var(--shadow-float)]"
            >
              {OPTIONAL.map((column) => (
                <DropdownMenu.CheckboxItem
                  key={column.key}
                  checked={has(column.key)}
                  onCheckedChange={() => toggle(column.key)}
                  onSelect={(e) => e.preventDefault()}
                  className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] text-ink outline-none data-[highlighted]:bg-brand-light"
                >
                  <span
                    className={`flex size-4 shrink-0 items-center justify-center rounded-xs border ${
                      has(column.key) ? "border-brand bg-brand text-white" : "border-line"
                    }`}
                    aria-hidden
                  >
                    {has(column.key) ? "✓" : ""}
                  </span>
                  {column.label}
                </DropdownMenu.CheckboxItem>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>

      {/* Escritorio */}
      <div className="hidden lg:block">
        <DataTable>
          <Thead>
            <tr>
              <Th>Contacto</Th>
              <Th>Empresa</Th>
              {has("cargo") ? <Th>Cargo</Th> : null}
              <Th>Estado</Th>
              <Th>Puntaje</Th>
              <Th>Próxima acción</Th>
              <Th>Responsable</Th>
              {has("ciudad") ? <Th>Ciudad</Th> : null}
              {has("pais") ? <Th>País</Th> : null}
              {has("origen") ? <Th>De dónde salió</Th> : null}
              {has("campana") ? <Th>Campaña</Th> : null}
              {has("producto") ? <Th>Interesado en</Th> : null}
              {has("creado") ? <Th>Creado</Th> : null}
              <Th align="right">Contactar</Th>
            </tr>
          </Thead>
          <tbody>
            {rows.map((row) => {
              const chip = contactChip(row.status as ContactStatus);
              const wa = whatsappLink(row.phone);
              return (
                <Tr key={row.id}>
                  <Td className="max-w-56">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={row.fullName} size="sm" />
                      <span className="min-w-0">
                        <Link href={`/contactos/${row.id}`} className="clip-1 font-medium text-ink hover:text-brand">
                          {row.fullName}
                        </Link>
                        <span className="clip-1 text-[12px] text-muted">
                          {row.email ?? formatPhone(row.phone)}
                        </span>
                      </span>
                    </div>
                  </Td>
                  <Td className="max-w-44">
                    {row.companyId ? (
                      <Link href={`/empresas/${row.companyId}`} className="clip-1 text-muted hover:text-brand">
                        {row.companyName}
                      </Link>
                    ) : (
                      <span className="text-[13px] text-muted-light">{SEGMENT_LABEL[row.segment as Segment]}</span>
                    )}
                  </Td>
                  {has("cargo") ? (
                    <Td className="max-w-40">
                      <span className="clip-1 text-muted">{row.position ?? "—"}</span>
                    </Td>
                  ) : null}
                  <Td>
                    <Badge tone={chip.tone} dot>
                      {chip.label}
                    </Badge>
                  </Td>
                  <Td>
                    <LeadScore
                      score={row.leadScore}
                      factors={row.leadScoreBreakdown}
                      manual={row.leadScoreManual}
                      size="sm"
                    />
                  </Td>
                  <Td className="max-w-48">
                    {row.nextAction ? (
                      <>
                        <span className="clip-1 text-[13px] text-ink">{row.nextAction}</span>
                        <span
                          className={`clip-1 text-[12px] ${
                            isOverdue(row.nextActionDate) ? "font-medium text-danger" : "text-muted"
                          }`}
                        >
                          {relativeDay(row.nextActionDate)}
                        </span>
                      </>
                    ) : (
                      <Badge tone="ambar" size="sm">
                        Sin próxima acción
                      </Badge>
                    )}
                  </Td>
                  <Td className="max-w-32">
                    <span className="clip-1 text-muted">{row.responsibleName ?? "Sin asignar"}</span>
                  </Td>
                  {has("ciudad") ? (
                    <Td>
                      <span className="clip-1 text-muted">{row.city ?? "—"}</span>
                    </Td>
                  ) : null}
                  {has("pais") ? (
                    <Td>
                      <span className="clip-1 text-muted">{row.country ?? "—"}</span>
                    </Td>
                  ) : null}
                  {has("origen") ? (
                    <Td className="max-w-36">
                      <span className="clip-1 text-muted">{row.sourceName ?? "—"}</span>
                    </Td>
                  ) : null}
                  {has("campana") ? (
                    <Td className="max-w-40">
                      <span className="clip-1 text-muted">{row.campaignName ?? "—"}</span>
                    </Td>
                  ) : null}
                  {has("producto") ? (
                    <Td className="max-w-44">
                      <span className="clip-1 text-muted">{row.productName ?? "—"}</span>
                    </Td>
                  ) : null}
                  {has("creado") ? (
                    <Td>
                      <span className="whitespace-nowrap text-muted">{formatDate(row.createdAt)}</span>
                    </Td>
                  ) : null}
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1">
                      {wa ? (
                        <Button variant="quiet" size="icon" asChild>
                          <a href={wa} target="_blank" rel="noreferrer" title={`WhatsApp a ${row.fullName}`}>
                            <MessageCircle aria-hidden />
                            <span className="sr-only">WhatsApp</span>
                          </a>
                        </Button>
                      ) : null}
                      {row.email ? (
                        <Button variant="quiet" size="icon" asChild>
                          <a href={`mailto:${row.email}`} title={`Correo a ${row.fullName}`}>
                            <Mail aria-hidden />
                            <span className="sr-only">Correo</span>
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </tbody>
        </DataTable>
      </div>

      {/* Movil y tablet */}
      <ul className="divide-y divide-line-soft lg:hidden">
        {rows.map((row) => {
          const chip = contactChip(row.status as ContactStatus);
          return (
            <li key={row.id}>
              <Link href={`/contactos/${row.id}`} className="block px-4 py-3.5 active:bg-canvas">
                <div className="flex items-start gap-3">
                  <Avatar name={row.fullName} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="clip-1 text-[15px] font-medium text-ink">{row.fullName}</p>
                    <p className="clip-1 text-[13px] text-muted">
                      {[row.position, row.companyName].filter(Boolean).join(" · ") ||
                        SEGMENT_LABEL[row.segment as Segment]}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge tone={chip.tone} size="sm" dot>
                        {chip.label}
                      </Badge>
                      {row.nextAction ? (
                        <Badge tone={isOverdue(row.nextActionDate) ? "rojo" : "gris"} size="sm">
                          {relativeDay(row.nextActionDate)}
                        </Badge>
                      ) : (
                        <Badge tone="ambar" size="sm">
                          Sin próxima acción
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
