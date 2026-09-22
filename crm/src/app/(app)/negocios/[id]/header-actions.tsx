"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Archive, CalendarPlus, MoreHorizontal, Pencil, ThumbsDown } from "lucide-react";
import { LOST_REASONS } from "@/db/enums";
import { archiveOpportunity, markLost } from "@/server/actions/opportunities";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { Drawer, Modal } from "@/components/ui/drawer";
import { Field, Select, Textarea } from "@/components/ui/field";
import { OpportunityForm } from "@/components/forms/opportunity-form";
import { DeliveryForm } from "@/components/forms/delivery-form";
import { useRun } from "@/lib/use-submit";
import type { Pickers, Refs } from "@/server/queries/refs";
import type { OpportunityDetail } from "@/server/queries/detail";

export function DealHeaderActions({
  opp,
  refs,
  pickers,
}: {
  opp: OpportunityDetail;
  refs: Refs;
  pickers: Pickers;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [service, setService] = useState(false);
  const [losing, setLosing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [reason, setReason] = useState(LOST_REASONS[0]!);
  const [notes, setNotes] = useState("");
  const { run, pending } = useRun();

  const stage = opp.stages.find((s) => s.slug === opp.stage);
  const isOpen = stage?.kind === "activa";

  return (
    <div className="no-print flex shrink-0 flex-wrap items-center gap-2">
      <Button variant="outline" onClick={() => setService(true)}>
        <CalendarPlus aria-hidden />
        <span className="hidden sm:inline">Programar servicio</span>
        <span className="sm:hidden">Servicio</span>
      </Button>
      <Button variant="outline" onClick={() => setEditing(true)}>
        <Pencil aria-hidden />
        Editar
      </Button>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button variant="quiet" size="icon" aria-label="Más acciones">
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="anim-in z-50 w-60 rounded-lg border border-line-soft bg-white p-1.5 shadow-[var(--shadow-float)]"
          >
            {isOpen ? (
              <DropdownMenu.Item
                onSelect={() => setLosing(true)}
                className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] text-ink outline-none data-[highlighted]:bg-warn-soft"
              >
                <ThumbsDown className="size-4 text-muted" aria-hidden />
                Marcar como perdido
              </DropdownMenu.Item>
            ) : null}
            <DropdownMenu.Separator className="my-1 h-px bg-line-soft" />
            <DropdownMenu.Item
              onSelect={() => setArchiving(true)}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] text-danger outline-none data-[highlighted]:bg-danger-soft"
            >
              <Archive className="size-4" aria-hidden />
              Archivar negocio
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Drawer
        open={editing}
        onOpenChange={setEditing}
        title="Editar negocio"
        width="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="editar-negocio">
              Guardar cambios
            </Button>
          </>
        }
      >
        <OpportunityForm
          formId="editar-negocio"
          refs={refs}
          pickers={pickers}
          defaults={{
            id: opp.id,
            name: opp.name,
            contactId: opp.contactId,
            companyId: opp.companyId,
            segment: opp.segment,
            productId: opp.productId,
            amount: opp.amount,
            currency: opp.currency,
            requiresInvoice: opp.requiresInvoice,
            stage: opp.stage,
            probability: opp.probability,
            expectedCloseOn: opp.expectedCloseOn,
            responsibleId: opp.responsibleId,
            sourceId: opp.sourceId,
            campaignId: opp.campaignId,
            notes: opp.notes,
          }}
          onDone={() => setEditing(false)}
        />
      </Drawer>

      <Drawer
        open={service}
        onOpenChange={setService}
        title="Programar el servicio"
        description="Cuando y donde se entrega lo que se vendio."
        footer={
          <>
            <Button variant="outline" onClick={() => setService(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="servicio-negocio">
              Guardar
            </Button>
          </>
        }
      >
        <DeliveryForm
          formId="servicio-negocio"
          refs={refs}
          scope={{ opportunityId: opp.id, companyId: opp.companyId, contactId: opp.contactId }}
          defaults={{ title: opp.name, productId: opp.productId }}
          onDone={() => setService(false)}
        />
      </Drawer>

      <Modal
        open={losing}
        onOpenChange={setLosing}
        title="Marcar este negocio como perdido"
        description="El motivo alimenta los reportes: sin el no se puede ver que esta fallando."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setLosing(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={async () => {
                const done = await run(() => markLost(opp.id, reason, notes), "Negocio marcado como perdido");
                if (done) setLosing(false);
              }}
            >
              Marcar perdido
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Motivo" htmlFor="motivo" required>
            <Select id="motivo" value={reason} onChange={(e) => setReason(e.target.value)}>
              {LOST_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Detalle" htmlFor="detalle">
            <Textarea
              id="detalle"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Que paso exactamente. Sirve para el reporte de pérdidas."
            />
          </Field>
          <p className="rounded-md border border-line-soft bg-canvas px-3 py-2 text-[12px] leading-relaxed text-muted">
            Los pendientes abiertos de este negocio se cancelan.
          </p>
        </div>
      </Modal>

      <Confirm
        open={archiving}
        onOpenChange={setArchiving}
        title="Archivar este negocio"
        description={`${opp.name} sale del pipeline y sus pendientes abiertos se cancelan. El historial se conserva.`}
        confirmLabel="Archivar"
        onConfirm={async () => {
          const done = await run(() => archiveOpportunity(opp.id), "Negocio archivado");
          if (done) router.push("/negocios");
        }}
      />
    </div>
  );
}
