import { formatMoney, formatNumber } from "@/lib/money";
import { Empty } from "@/components/ui/empty";
import type { Breakdown } from "@/server/queries/reports";

/**
 * Barras horizontales en HTML, sin libreria de graficas. Para comparar seis o
 * diez categorias se lee mejor que un pastel, y el valor siempre esta escrito.
 */
export function Bars({
  rows,
  mode = "valor",
  emptyTitle = "Sin datos en este periodo",
  emptyMessage = "Cambia el rango de fechas o los filtros.",
}: {
  rows: Breakdown[];
  mode?: "valor" | "conteo";
  emptyTitle?: string;
  emptyMessage?: string;
}) {
  const visible = rows.filter((r) => (mode === "valor" ? r.value > 0 : r.count > 0)).slice(0, 10);
  if (visible.length === 0) {
    return <Empty title={emptyTitle} message={emptyMessage} className="py-8" />;
  }

  const max = Math.max(...visible.map((r) => (mode === "valor" ? r.value : r.count)));

  return (
    <ul className="space-y-2.5 px-4 py-4 sm:px-5">
      {visible.map((row) => {
        const value = mode === "valor" ? row.value : row.count;
        const width = max > 0 ? Math.max(2, (value / max) * 100) : 0;
        return (
          <li key={row.key}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="clip-1 text-[13px] text-ink">{row.label}</span>
              <span className="tnum shrink-0 text-[13px] font-semibold text-ink">
                {mode === "valor" ? formatMoney(row.value) : formatNumber(row.count)}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-off-soft">
                <div className="h-full rounded-full bg-brand" style={{ width: `${width}%` }} />
              </div>
              {mode === "valor" && row.count > 0 ? (
                <span className="tnum w-16 shrink-0 text-right text-[11px] text-muted">
                  {row.count === 1 ? "1 negocio" : `${row.count} negocios`}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
