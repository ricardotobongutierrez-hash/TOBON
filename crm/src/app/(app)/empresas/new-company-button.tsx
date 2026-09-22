"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { CompanyForm } from "@/components/forms/company-form";
import type { Refs } from "@/server/queries/refs";

export function NewCompanyButton({ refs }: { refs: Refs }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus aria-hidden />
        Nueva empresa
      </Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        title="Nueva empresa"
        description="Solo el nombre es obligatorio."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="nueva-empresa">
              Crear empresa
            </Button>
          </>
        }
      >
        <CompanyForm
          formId="nueva-empresa"
          refs={refs}
          onDone={(id) => {
            setOpen(false);
            if (id) router.push(`/empresas/${id}`);
          }}
        />
      </Drawer>
    </>
  );
}
