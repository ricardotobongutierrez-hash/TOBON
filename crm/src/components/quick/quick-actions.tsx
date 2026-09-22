"use client";

import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Building2, ChevronDown, Handshake, ListChecks, Plus, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { ContactForm } from "@/components/forms/contact-form";
import { CompanyForm } from "@/components/forms/company-form";
import { OpportunityForm } from "@/components/forms/opportunity-form";
import { TaskForm } from "@/components/forms/task-form";
import type { Pickers, Refs } from "@/server/queries/refs";

type Which = "contacto" | "empresa" | "negocio" | "seguimiento" | null;

const OPTIONS = [
  { key: "contacto" as const, label: "Nuevo contacto", icon: User, hint: "Una persona" },
  { key: "empresa" as const, label: "Nueva empresa", icon: Building2, hint: "Una organización" },
  { key: "negocio" as const, label: "Nuevo negocio", icon: Handshake, hint: "Una oportunidad de venta" },
  { key: "seguimiento" as const, label: "Nuevo seguimiento", icon: ListChecks, hint: "Algo que hay que hacer" },
];

/**
 * Las cuatro acciones que se usan todos los dias, siempre a un clic y en un
 * panel lateral: nunca se pierde la pantalla en la que estaba el usuario.
 */
export function QuickActions({ refs, pickers }: { refs: Refs; pickers: Pickers }) {
  const [open, setOpen] = useState<Which>(null);

  const titles: Record<Exclude<Which, null>, { title: string; description: string }> = {
    contacto: { title: "Nuevo contacto", description: "Solo el nombre es obligatorio." },
    empresa: { title: "Nueva empresa", description: "Después puedes ligarle contactos y negocios." },
    negocio: { title: "Nuevo negocio", description: "Una oportunidad concreta, con valor y siguiente paso." },
    seguimiento: { title: "Nuevo seguimiento", description: "Qué hay que hacer y cuando." },
  };

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button size="md" className="shrink-0">
            <Plus aria-hidden />
            <span className="hidden sm:inline">Nuevo</span>
            <ChevronDown className="opacity-70" aria-hidden />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="anim-in z-50 w-64 rounded-lg border border-line-soft bg-white p-1.5 shadow-[var(--shadow-float)]"
          >
            {OPTIONS.map((option) => (
              <DropdownMenu.Item
                key={option.key}
                onSelect={() => setOpen(option.key)}
                className="flex cursor-pointer items-start gap-3 rounded-md px-2.5 py-2 outline-none data-[highlighted]:bg-brand-light"
              >
                <option.icon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-[14px] font-medium text-ink">{option.label}</span>
                  <span className="block text-[12px] text-muted">{option.hint}</span>
                </span>
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {open ? (
        <Drawer
          open
          onOpenChange={(v) => !v && setOpen(null)}
          title={titles[open].title}
          description={titles[open].description}
          width={open === "negocio" ? "lg" : "md"}
          footer={
            <>
              <Button variant="outline" onClick={() => setOpen(null)}>
                Cancelar
              </Button>
              <Button type="submit" form="quick-form">
                Guardar
              </Button>
            </>
          }
        >
          {open === "contacto" ? (
            <ContactForm formId="quick-form" refs={refs} pickers={pickers} onDone={() => setOpen(null)} />
          ) : null}
          {open === "empresa" ? (
            <CompanyForm formId="quick-form" refs={refs} onDone={() => setOpen(null)} />
          ) : null}
          {open === "negocio" ? (
            <OpportunityForm formId="quick-form" refs={refs} pickers={pickers} onDone={() => setOpen(null)} />
          ) : null}
          {open === "seguimiento" ? (
            <TaskForm formId="quick-form" refs={refs} pickers={pickers} onDone={() => setOpen(null)} />
          ) : null}
        </Drawer>
      ) : null}
    </>
  );
}
