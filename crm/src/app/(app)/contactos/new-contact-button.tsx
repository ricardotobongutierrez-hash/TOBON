"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { ContactForm } from "@/components/forms/contact-form";
import type { Pickers, Refs } from "@/server/queries/refs";

export function NewContactButton({ refs, pickers }: { refs: Refs; pickers: Pickers }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Nuevo contacto
      </Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title="Nuevo contacto"
        description="Solo el nombre es obligatorio. Lo demas se puede completar después."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="nuevo-contacto">
              Crear contacto
            </Button>
          </>
        }
      >
        <ContactForm
          formId="nuevo-contacto"
          refs={refs}
          pickers={pickers}
          onDone={(id) => {
            setOpen(false);
            if (id) router.push(`/contactos/${id}`);
          }}
        />
      </Drawer>
    </>
  );
}
