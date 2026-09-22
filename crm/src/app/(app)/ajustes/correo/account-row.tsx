"use client";

import { useState } from "react";
import { Mail, RefreshCw, Unplug } from "lucide-react";
import { disconnectEmail, syncEmail } from "@/server/actions/email";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Confirm } from "@/components/ui/confirm";
import { useRun } from "@/lib/use-submit";
import { formatDateTime } from "@/lib/dates";
import { toast } from "sonner";
import type { EmailAccount } from "@/db/schema";

type EmailAccountRowProps = { account: EmailAccount; messageCount: number };

export function EmailAccountRow({ account, messageCount }: EmailAccountRowProps) {
  const [disconnecting, setDisconnecting] = useState(false);
  const { run, pending } = useRun();

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 sm:px-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-brand-light text-brand-dark">
          <Mail className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="break-anywhere text-[14px] font-medium text-ink">{account.email}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge
              tone={account.status === "conectada" ? "verde" : account.status === "error" ? "rojo" : "gris"}
              size="sm"
              dot
            >
              {account.status === "conectada" ? "Conectada" : account.status === "error" ? "Con error" : "Desconectada"}
            </Badge>
            <span className="tnum text-[12px] text-muted">{messageCount} correos asociados</span>
          </div>
          <p className="mt-1 text-[12px] text-muted">
            {account.lastSyncAt
              ? `Ultima sincronizacion: ${formatDateTime(account.lastSyncAt)}`
              : "Todavía no se ha sincronizado"}
          </p>
          {account.lastError ? (
            <p className="break-anywhere mt-1 text-[12px] text-danger">{account.lastError}</p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          loading={pending}
          onClick={async () => {
            const result = await syncEmail(account.id);
            if (result.ok) {
              toast.success(
                result.data.imported === 0
                  ? "Todo estaba al día, no había correos nuevos"
                  : `Se asociaron ${result.data.imported} correos`,
              );
            } else {
              toast.error(result.error);
            }
          }}
        >
          <RefreshCw aria-hidden />
          Sincronizar
        </Button>
        <Button variant="quiet" size="sm" onClick={() => setDisconnecting(true)}>
          <Unplug aria-hidden />
          Desconectar
        </Button>
      </div>

      <Confirm
        open={disconnecting}
        onOpenChange={setDisconnecting}
        title="Desconectar esta cuenta de correo"
        description={`Se borran los tokens de ${account.email}. Los correos que ya estan en el timeline se quedan, pero deja de sincronizarse.`}
        confirmLabel="Desconectar"
        onConfirm={async () => {
          await run(() => disconnectEmail(account.id), "Cuenta desconectada");
        }}
      />
    </li>
  );
}
