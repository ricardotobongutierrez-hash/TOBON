"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteDemoData } from "@/server/actions/settings";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { useRun } from "@/lib/use-submit";
import { toast } from "sonner";

export function DemoDataPanel({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const { pending } = useRun();

  if (count === 0) {
    return (
      <p className="text-[13px] leading-relaxed text-muted">
        No quedan datos de demostración. Todo lo que ves en el CRM es información real que cargó el equipo.
      </p>
    );
  }

  return (
    <>
      <p className="text-[13px] leading-relaxed text-muted">
        La instalación vino con empresas, contactos, negocios, propuestas, facturas, pagos y pendientes de
        prueba, para poder evaluar el sistema de una vez. Están marcados aparte, así que al borrarlos no se
        toca nada de lo que hayas cargado.
      </p>
      <div className="mt-3">
        <Button variant="danger" onClick={() => setOpen(true)}>
          <Trash2 aria-hidden />
          Eliminar los datos de demostración
        </Button>
      </div>

      <Confirm
        open={open}
        onOpenChange={setOpen}
        title="Eliminar los datos de demostración"
        description="Se borran todas las empresas, contactos, negocios, propuestas, facturas, pagos, servicios y pendientes de prueba. Los registros reales no se tocan. Esta acción no se puede deshacer."
        confirmLabel="Eliminar todo lo de prueba"
        onConfirm={async () => {
          const result = await deleteDemoData();
          if (result.ok) toast.success(`Se eliminaron ${result.data.borrados} registros de prueba`);
          else toast.error(result.error);
        }}
      />
    </>
  );
}
