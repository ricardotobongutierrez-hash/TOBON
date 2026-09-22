"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Archive, MoreHorizontal, Pencil, Plus, UserPlus } from "lucide-react";
import { archiveCompany } from "@/server/actions/companies";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { Drawer } from "@/components/ui/drawer";
import { CompanyForm } from "@/components/forms/company-form";
import { ContactForm } from "@/components/forms/contact-form";
import { OpportunityForm } from "@/components/forms/opportunity-form";
import { useRun } from "@/lib/use-submit";
import type { Pickers, Refs } from "@/server/queries/refs";
import type { CompanyDetail } from "@/server/queries/detail";

export function CompanyHeaderActions({
  company,
  refs,
  pickers,
}: {
  company: CompanyDetail;
  refs: Refs;
  pickers: Pickers;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<"editar" | "contacto" | "negocio" | null>(null);
  const [archiving, setArchiving] = useState(false);
  const { run } = useRun();

  return (
    <div className="no-print flex shrink-0 flex-wrap items-center gap-2">
      <Button variant="outline" onClick={() => setOpen("negocio")}>
        <Plus aria-hidden />
        Nuevo negocio
      </Button>
      <Button variant="outline" onClick={() => setOpen("contacto")}>
        <UserPlus aria-hidden />
        <span className="hidden sm:inline">Agregar contacto</span>
        <span className="sm:hidden">Contacto</span>
      </Button>
      <Button variant="quiet" size="icon" onClick={() => setOpen("editar")} aria-label="Editar empresa">
        <Pencil aria-hidden />
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
              onSelect={() => setArchiving(true)}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] text-danger outline-none data-[highlighted]:bg-danger-soft"
            >
              <Archive className="size-4" aria-hidden />
              Archivar empresa
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Drawer
        open={open === "editar"}
        onOpenChange={(v) => !v && setOpen(null)}
        title="Editar empresa"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="empresa-form">
              Guardar cambios
            </Button>
          </>
        }
      >
        <CompanyForm
          formId="empresa-form"
          refs={refs}
          defaults={{
            id: company.id,
            name: company.name,
            website: company.website,
            industry: company.industry,
            country: company.country,
            city: company.city,
            size: company.size,
            responsibleId: company.responsibleId,
            sourceId: company.sourceId,
            purchasingCapacity: company.purchasingCapacity,
            notes: company.notes,
          }}
          onDone={() => setOpen(null)}
        />
      </Drawer>

      <Drawer
        open={open === "contacto"}
        onOpenChange={(v) => !v && setOpen(null)}
        title="Agregar contacto"
        description={`En ${company.name}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="contacto-empresa">
              Crear contacto
            </Button>
          </>
        }
      >
        <ContactForm
          formId="contacto-empresa"
          refs={refs}
          pickers={pickers}
          defaults={{
            companyId: company.id,
            segment: "b2b",
            responsibleId: company.responsibleId,
            sourceId: company.sourceId,
          }}
          onDone={() => setOpen(null)}
        />
      </Drawer>

      <Drawer
        open={open === "negocio"}
        onOpenChange={(v) => !v && setOpen(null)}
        title="Nuevo negocio"
        description={`Para ${company.name}`}
        width="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="negocio-empresa">
              Crear negocio
            </Button>
          </>
        }
      >
        <OpportunityForm
          formId="negocio-empresa"
          refs={refs}
          pickers={pickers}
          defaults={{
            companyId: company.id,
            contactId: company.contacts[0]?.id ?? null,
            segment: "b2b",
            responsibleId: company.responsibleId,
            sourceId: company.sourceId,
          }}
          onDone={(id) => {
            setOpen(null);
            if (id) router.push(`/negocios/${id}`);
          }}
        />
      </Drawer>

      <Confirm
        open={archiving}
        onOpenChange={setArchiving}
        title="Archivar esta empresa"
        description={`${company.name} sale de las listas y sus pendientes abiertos se cancelan. Los contactos y negocios se conservan.`}
        confirmLabel="Archivar"
        onConfirm={async () => {
          const done = await run(() => archiveCompany(company.id), "Empresa archivada");
          if (done) router.push("/empresas");
        }}
      />
    </div>
  );
}
