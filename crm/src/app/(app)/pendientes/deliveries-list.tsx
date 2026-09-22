"use client";

import Link from "next/link";
import { CalendarClock, MapPin, Video, Wallet } from "lucide-react";
import type { DeliveryStatus } from "@/db/enums";
import { deliveryChip, paymentChip } from "@/lib/status";
import { formatMoneyShort } from "@/lib/money";
import { formatDateTime, relativeDay } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { PendingDelivery } from "@/server/queries/deliveries";

/**
 * Lo vendido que todavía no se ha entregado. Lo que no tiene fecha es lo que
 * hay que coordinar, así que se marca aparte.
 */
export function DeliveriesList({ rows }: { rows: PendingDelivery[] }) {
  return (
    <ul className="divide-y divide-line-soft">
      {rows.map((row) => {
        const client = row.companyName ?? row.contactName ?? "Sin cliente";
        const href = row.companyId
          ? `/empresas/${row.companyId}`
          : row.contactId
            ? `/contactos/${row.contactId}`
            : null;
        const chip = deliveryChip(row.status as DeliveryStatus);
        return (
          <li key={row.id} className="px-4 py-3.5 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {href ? (
                    <Link href={href} className="clip-1 text-[14px] font-semibold text-ink hover:text-brand">
                      {client}
                    </Link>
                  ) : (
                    <span className="text-[14px] font-semibold text-ink">{client}</span>
                  )}
                  <Badge tone={chip.tone} size="sm" dot>
                    {chip.label}
                  </Badge>
                  {/* Solo cuando el cobro pide algo. "No vencido" es ruido. */}
                  {row.paymentStatus && ["pendiente", "parcial", "vencido"].includes(row.paymentStatus) ? (
                    <Badge tone={paymentChip(row.paymentStatus).tone} size="sm">
                      <Wallet className="size-3" aria-hidden />
                      {paymentChip(row.paymentStatus).label}
                    </Badge>
                  ) : null}
                </div>

                <p className="mt-1 break-anywhere text-[14px] leading-snug text-ink">{row.title}</p>

                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="size-3.5" aria-hidden />
                    {row.scheduledAt ? (
                      <>
                        {formatDateTime(row.scheduledAt)} · {relativeDay(row.scheduledAt)}
                      </>
                    ) : (
                      <span className="font-medium text-warn">Falta acordar la fecha</span>
                    )}
                  </span>
                  {row.isOnline ? (
                    <span className="inline-flex items-center gap-1">
                      <Video className="size-3.5" aria-hidden />
                      Online
                    </span>
                  ) : row.location ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" aria-hidden />
                      {row.location}
                    </span>
                  ) : null}
                  <span>{row.responsibleName ?? "Sin responsable"}</span>
                  {row.opportunityAmount && Number(row.opportunityAmount) > 0 ? (
                    <span className="tnum font-medium text-ink">
                      {formatMoneyShort(row.opportunityAmount, (row.opportunityCurrency as "COP") ?? "COP")}
                    </span>
                  ) : null}
                </p>

                {row.notes ? (
                  <p className="clip-2 mt-1.5 text-[12px] leading-relaxed text-muted">{row.notes}</p>
                ) : null}
              </div>

              {row.opportunityId ? (
                <Button variant="outline" size="sm" asChild className="no-print">
                  <Link href={`/negocios/${row.opportunityId}`}>Abrir el negocio</Link>
                </Button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
