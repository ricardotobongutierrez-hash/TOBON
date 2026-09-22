"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Archive, Gauge, MoreHorizontal, Pencil, Plus } from "lucide-react";
import { archiveContact, setLeadScore } from "@/server/actions/contacts";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { Drawer, Modal } from "@/components/ui/drawer";
import { Field, Input } from "@/components/ui/field";
import { ContactForm } from "@/components/forms/contact-form";
import { OpportunityForm } from "@/components/forms/opportunity-form";
import { useRun } from "@/lib/use-submit";
import type { Pickers, Refs } from "@/server/queries/refs";
import type { ContactDetail } from "@/server/queries/detail";

export function ContactHeaderActions({
  contact,
  refs,
  pickers,
}: {
  contact: ContactDetail;
  refs: Refs;
  pickers: Pickers;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [newDeal, setNewDeal] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [manual, setManual] = useState(String(contact.leadScoreManual ?? ""));
  const { run } = useRun();

  return (
    <div className="no-print flex shrink-0 flex-wrap items-center gap-2">
      <Button variant="outline" onClick={() => setNewDeal(true)}>
        <Plus aria-hidden />
        Nuevo negocio
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
            className="anim-in z-50 w-56 rounded-lg border border-line-soft bg-white p-1.5 shadow-[var(--shadow-float)]"
          >
            <DropdownMenu.Item
              onSelect={() => setScoring(true)}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] text-ink outline-none data-[highlighted]:bg-brand-light"
            >
              <Gauge className="size-4 text-muted" aria-hidden />
              Ajustar el puntaje
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-line-soft" />
            <DropdownMenu.Item
              onSelect={() => setArchiving(true)}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] text-danger outline-none data-[highlighted]:bg-danger-soft"
            >
              <Archive className="size-4" aria-hidden />
              Archivar contacto
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Drawer
        open={editing}
        onOpenChange={setEditing}
        title="Editar contacto"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="editar-contacto">
              Guardar cambios
            </Button>
          </>
        }
      >
        <ContactForm
          formId="editar-contacto"
          refs={refs}
          pickers={pickers}
          defaults={{
            id: contact.id,
            fullName: contact.fullName,
            phone: contact.phone,
            email: contact.email,
            companyId: contact.companyId,
            position: contact.position,
            city: contact.city,
            country: contact.country,
            segment: contact.segment,
            sourceId: contact.sourceId,
            campaignId: contact.campaignId,
            interestProductId: contact.interestProductId,
            responsibleId: contact.responsibleId,
            status: contact.status,
            notes: contact.notes,
            tags: contact.tags.join(", "),
          }}
          onDone={() => setEditing(false)}
        />
      </Drawer>

      <Drawer
        open={newDeal}
        onOpenChange={setNewDeal}
        title="Nuevo negocio"
        description={`Para ${contact.fullName}`}
        width="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setNewDeal(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="nuevo-negocio-contacto">
              Crear negocio
            </Button>
          </>
        }
      >
        <OpportunityForm
          formId="nuevo-negocio-contacto"
          refs={refs}
          pickers={pickers}
          defaults={{
            contactId: contact.id,
            companyId: contact.companyId,
            segment: contact.segment,
            productId: contact.interestProductId,
            responsibleId: contact.responsibleId,
          }}
          onDone={(dealId) => {
            setNewDeal(false);
            if (dealId) router.push(`/negocios/${dealId}`);
          }}
        />
      </Drawer>

      <Modal
        open={scoring}
        onOpenChange={setScoring}
        title="Ajustar el puntaje a mano"
        description="Si fijas un valor, el calculo automático deja de modificarlo. Deja el campo vacio para volver al automático."
        size="sm"
        footer={
          <>
            <Button
              variant="outline"
              onClick={async () => {
                await run(() => setLeadScore(contact.id, null), "El puntaje vuelve al calculo automático");
                setScoring(false);
              }}
            >
              Volver al automático
            </Button>
            <Button
              onClick={async () => {
                const value = manual.trim() === "" ? null : Math.max(0, Math.min(100, Number(manual)));
                await run(() => setLeadScore(contact.id, value), "Puntaje actualizado");
                setScoring(false);
              }}
            >
              Guardar
            </Button>
          </>
        }
      >
        <Field label="Puntaje de 0 a 100" htmlFor="puntaje">
          <Input
            id="puntaje"
            type="number"
            min={0}
            max={100}
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder={String(contact.leadScore)}
          />
        </Field>
      </Modal>

      <Confirm
        open={archiving}
        onOpenChange={setArchiving}
        title="Archivar este contacto"
        description={`${contact.fullName} sale de las listas y sus pendientes abiertos se cancelan. El historial se conserva y se puede restaurar.`}
        confirmLabel="Archivar"
        onConfirm={async () => {
          const okDone = await run(() => archiveContact(contact.id), "Contacto archivado");
          if (okDone) router.push("/contactos");
        }}
      />
    </div>
  );
}
