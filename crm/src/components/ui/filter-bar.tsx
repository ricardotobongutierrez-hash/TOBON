"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Select } from "./field";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export type FilterOption = { value: string; label: string };
export type FilterDef = {
  name: string;
  label: string;
  options: FilterOption[];
};

/**
 * Filtros de lista. Viven en la URL, asi que un filtro se puede compartir por
 * WhatsApp y el boton de atras funciona.
 */
export function FilterBar({
  filters,
  searchPlaceholder = "Buscar",
  children,
}: {
  filters: FilterDef[];
  searchPlaceholder?: string;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  useEffect(() => {
    setQ(params.get("q") ?? "");
  }, [params]);

  function apply(next: URLSearchParams) {
    next.delete("pagina");
    router.push(`${pathname}${next.toString() ? `?${next}` : ""}`);
  }

  function setParam(name: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    apply(next);
  }

  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q.trim()) next.set("q", q.trim());
      else next.delete("q");
      apply(next);
    }, 320);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const activeCount = filters.filter((f) => params.get(f.name)).length + (params.get("q") ? 1 : 0);

  return (
    <div className="no-print mb-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-10 w-full rounded-md border border-line bg-white pl-9 pr-3 text-[14px] text-ink placeholder:text-muted-light focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 [&::-webkit-search-cancel-button]:hidden"
          />
        </div>

        {filters.map((filter) => (
          <label key={filter.name} className="min-w-0">
            <span className="sr-only">{filter.label}</span>
            <Select
              value={params.get(filter.name) ?? ""}
              onChange={(e) => setParam(filter.name, e.target.value)}
              className={cn(
                "w-auto min-w-[9rem] max-w-[14rem] text-[13px]",
                params.get(filter.name) && "border-brand bg-brand-light text-brand-dark",
              )}
            >
              <option value="">{filter.label}</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
        ))}

        {activeCount > 0 ? (
          <Button variant="quiet" size="sm" onClick={() => router.push(pathname)}>
            <X aria-hidden />
            Limpiar
          </Button>
        ) : null}

        {children}
      </div>
    </div>
  );
}
