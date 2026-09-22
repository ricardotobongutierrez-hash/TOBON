"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Exportar a PDF sin dependencias: la impresion del navegador ya lo hace. */
export function PrintButton() {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      <Printer aria-hidden />
      <span className="hidden sm:inline">Imprimir o guardar en PDF</span>
      <span className="sm:hidden">Imprimir</span>
    </Button>
  );
}
