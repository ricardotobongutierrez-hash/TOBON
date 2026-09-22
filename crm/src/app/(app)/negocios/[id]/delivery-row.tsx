"use client";

import { useState } from "react";
import { CalendarClock, MapPin, Video } from "lucide-react";
import { DELIVERY_STATUSES, DELIVERY_STATUS_LABEL, type DeliveryStatus } from "@/db/enums";
import { setDeliveryState } from "@/server/actions/deliveries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/drawer";
import { Field, Input, Select } from "@/components/ui/field";
import { useRun } from "@/lib/use-submit";
import { deliveryChip } from "@/lib/status";
import { formatDateTime, formatDateTimeInput } from "@/lib/dates";
import type { ServiceDelivery } from "@/db/schema";

export function DeliveryRow({ delivery }: { delivery: ServiceDelivery }) {
  const { run, pending } = useRun();
  const [scheduling, setScheduling] = useState(false);
  const [when, setWhen] = useState(formatDateTimeInput(delivery.scheduledAt ?? new Date()));
  const chip = deliveryChip(delivery.status);

  return (
    <li className="px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="break-anywhere text-[14px] font-medium text-ink">{delivery.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
            {delivery.scheduledAt ? (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3.5" aria-hidden />
                {formatDateTime(delivery.scheduledAt)}
              </span>
            ) : (
              <span>Sin fecha</span>
            )}
            {delivery.isOnline ? (
              <span className="inline-flex items-center gap-1">
                <Video className="size-3.5" aria-hidden />
                Online
              </span>
            ) : delivery.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                {delivery.location}
              </span>
            ) : null}
          </p>
          {delivery.notes ? <p className="mt-1 break-anywhere text-[12px] text-muted">{delivery.notes}</p> : null}
        </div>
        <Badge tone={chip.tone} size="sm" dot>
          {chip.label}
        </Badge>
      </div>

      <div className="no-print mt-3 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setScheduling(true)}>
          {delivery.scheduledAt ? "Cambiar la fecha" : "Programar"}
        </Button>
        {delivery.status !== "completado" ? (
          <Button
            variant="quiet"
            size="sm"
            disabled={pending}
            onClick={() => void run(() => setDeliveryState(delivery.id, "completado"), "Servicio completado")}
          >
            Marcar completado
          </Button>
        ) : null}
        <label className="relative ml-auto">
          <span className="sr-only">Cambiar el estado del servicio</span>
          <Select
            value=""
            disabled={pending}
            onChange={(e) =>
              e.target.value && void run(() => setDeliveryState(delivery.id, e.target.value as DeliveryStatus), "Estado actualizado")
            }
            className="h-8 w-auto min-w-0 text-[12px]"
          >
            <option value="">Otro estado…</option>
            {DELIVERY_STATUSES.filter((s) => s !== delivery.status).map((s) => (
              <option key={s} value={s}>
                {DELIVERY_STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <Modal
        open={scheduling}
        onOpenChange={setScheduling}
        title="Programar el servicio"
        description={delivery.title}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setScheduling(false)}>
              Cancelar
            </Button>
            <Button
              loading={pending}
              onClick={async () => {
                await run(() => setDeliveryState(delivery.id, "programado", when), "Servicio programado");
                setScheduling(false);
              }}
            >
              Guardar
            </Button>
          </>
        }
      >
        <Field label="Fecha y hora" htmlFor={`fecha-servicio-${delivery.id}`} required>
          <Input
            id={`fecha-servicio-${delivery.id}`}
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
        </Field>
      </Modal>
    </li>
  );
}
