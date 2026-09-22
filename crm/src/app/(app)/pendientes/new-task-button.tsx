"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { TaskForm } from "@/components/forms/task-form";
import type { Pickers, Refs } from "@/server/queries/refs";

export function NewTaskButton({ refs, pickers }: { refs: Refs; pickers: Pickers }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Nuevo seguimiento
      </Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title="Nuevo seguimiento"
        description="Qué hay que hacer, con quien y cuando."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="nuevo-pendiente">
              Agendar
            </Button>
          </>
        }
      >
        <TaskForm formId="nuevo-pendiente" refs={refs} pickers={pickers} onDone={() => setOpen(false)} />
      </Drawer>
    </>
  );
}
