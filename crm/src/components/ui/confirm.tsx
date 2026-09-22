"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "./drawer";
import { Button } from "./button";

/**
 * Solo se confirma lo que duele deshacer: borrar, marcar perdido, anular una
 * factura, desconectar el correo. Lo demas se guarda sin preguntar.
 */
export function Confirm({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "danger",
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "primary";
  onConfirm: () => void | Promise<void>;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = React.useState(false);

  async function run() {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={run} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex gap-3 rounded-md border border-warn/20 bg-warn-soft px-3 py-2.5 text-[13px] text-ink">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
        <p className="leading-relaxed">Esta acción se registra en el historial del registro.</p>
      </div>
      {children}
    </Modal>
  );
}
