"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Panel lateral para crear y editar. Se prefiere sobre una pantalla nueva: el
 * usuario no pierde el contexto de donde estaba.
 * En movil entra desde abajo y ocupa casi toda la altura.
 */
export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "md" | "lg" | "xl";
}) {
  const widths = {
    md: "sm:max-w-md",
    lg: "sm:max-w-xl",
    xl: "sm:max-w-3xl",
  }[width];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/25 backdrop-blur-[1px] data-[state=open]:anim-in" />
        <Dialog.Content
          className={cn(
            "fixed z-50 flex flex-col bg-white shadow-[var(--shadow-float)] focus:outline-none",
            // Movil: entra desde abajo, sin pasar del 92 % de la altura.
            "inset-x-0 bottom-0 top-auto max-h-[92vh] rounded-t-lg",
            // Escritorio: panel a la derecha de altura completa. La altura tiene
            // que quedar acotada (top y bottom en 0), o el cuerpo no desplaza y
            // el pie con el boton de guardar se sale de la pantalla.
            "sm:left-auto sm:right-0 sm:top-0 sm:bottom-0 sm:max-h-none sm:w-full sm:rounded-none sm:rounded-l-lg",
            widths,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line-soft px-4 py-3.5 sm:px-6">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold text-ink">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-[13px] text-muted">{description}</Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              className="-mr-1 shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-off-soft hover:text-ink"
              aria-label="Cerrar"
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>
          {footer ? (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-soft bg-canvas px-4 py-3 sm:px-6">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Ventana centrada, para confirmaciones y preguntas cortas. */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = { sm: "sm:max-w-sm", md: "sm:max-w-lg", lg: "sm:max-w-2xl" }[size];
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/25 backdrop-blur-[1px]" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100%-1.5rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg bg-white shadow-[var(--shadow-float)] focus:outline-none",
            sizes,
          )}
        >
          <div className="flex items-start justify-between gap-4 px-5 pt-5">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-semibold text-ink">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-1 text-[13px] leading-relaxed text-muted">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              className="-mr-1 -mt-1 shrink-0 rounded-md p-1.5 text-muted hover:bg-off-soft hover:text-ink"
              aria-label="Cerrar"
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>
          {children ? <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div> : <div className="h-4" />}
          {footer ? (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-soft bg-canvas px-5 py-3">
              {footer}
            </div>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
