"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { formatNumber } from "@/lib/money";

export function Pagination({
  page,
  perPage,
  total,
  noun = "registros",
}: {
  page: number;
  perPage: number;
  total: number;
  noun?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const pages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);

  function go(next: number) {
    const search = new URLSearchParams(params.toString());
    if (next <= 1) search.delete("pagina");
    else search.set("pagina", String(next));
    router.push(`${pathname}${search.toString() ? `?${search}` : ""}`);
  }

  if (total === 0) return null;

  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-4 py-3 text-[13px] text-muted">
      <p className="tnum">
        {formatNumber(from)} a {formatNumber(to)} de {formatNumber(total)} {noun}
      </p>
      {pages > 1 ? (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => go(page - 1)} disabled={page <= 1}>
            <ChevronLeft aria-hidden />
            Anterior
          </Button>
          <span className="tnum px-1">
            {page} de {pages}
          </span>
          <Button variant="outline" size="sm" onClick={() => go(page + 1)} disabled={page >= pages}>
            Siguiente
            <ChevronRight aria-hidden />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
