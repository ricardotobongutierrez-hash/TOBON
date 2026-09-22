"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { OpportunityForm } from "@/components/forms/opportunity-form";
import type { Pickers, Refs } from "@/server/queries/refs";

export function NewDealButton({ refs, pickers }: { refs: Refs; pickers: Pickers }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Nuevo negocio
      </Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title="Nuevo negocio"
        description="Una oportunidad concreta, con valor, etapa y siguiente paso."
        width="lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="nuevo-negocio">
              Crear negocio
            </Button>
          </>
        }
      >
        <OpportunityForm
          formId="nuevo-negocio"
          refs={refs}
          pickers={pickers}
          onDone={(id) => {
            setOpen(false);
            if (id) router.push(`/negocios/${id}`);
          }}
        />
      </Drawer>
    </>
  );
}
