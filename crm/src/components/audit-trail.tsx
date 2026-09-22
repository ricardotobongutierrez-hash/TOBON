import { History } from "lucide-react";
import { formatDateTime } from "@/lib/dates";
import { auditFor } from "@/lib/audit";

/**
 * Historial de cambios importantes. Vive dentro del registro, discretamente, y
 * no en una pantalla de auditoria que nadie abre.
 */
export async function AuditTrail({ entityType, entityId }: { entityType: string; entityId: string }) {
  const entries = await auditFor(entityType, entityId, 20);
  if (entries.length === 0) {
    return (
      <p className="px-4 py-4 text-[13px] text-muted sm:px-5">
        Todavía no hay cambios registrados en este registro.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-line-soft">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3 px-4 py-3 sm:px-5">
          <History className="mt-0.5 size-4 shrink-0 text-muted-light" aria-hidden />
          <div className="min-w-0">
            <p className="break-anywhere text-[13px] text-ink">{entry.summary}</p>
            <p className="text-[12px] text-muted">
              {entry.userName ?? "Sistema"} · {formatDateTime(entry.createdAt)}
            </p>
            {entry.changes && entry.changes.length > 0 ? (
              <ul className="mt-1 space-y-0.5">
                {entry.changes.map((change, index) => (
                  <li key={index} className="break-anywhere text-[12px] text-muted">
                    <span className="font-medium">{change.field}:</span> {change.from ?? "vacio"} →{" "}
                    {change.to ?? "vacio"}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
