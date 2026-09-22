"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, FileText, Handshake, Loader2, Receipt, Search, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchHit } from "@/server/queries/search";

const ICONS = {
  contacto: User,
  empresa: Building2,
  negocio: Handshake,
  propuesta: FileText,
  factura: Receipt,
} as const;

const LABELS = {
  contacto: "Contacto",
  empresa: "Empresa",
  negocio: "Negocio",
  propuesta: "Propuesta",
  factura: "Factura",
} as const;

/**
 * Buscador universal. Se escribe y aparecen contactos, empresas, negocios,
 * propuestas y facturas. Con Enter se abre el primer resultado.
 */
export function GlobalSearch({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [loading, startLoading] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Atajo: barra inclinada enfoca el buscador, como en el correo.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      if (event.key === "/" && !typing) {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) {
      setHits([]);
      return;
    }
    // Se espera a que deje de escribir para no disparar una consulta por letra.
    const timer = setTimeout(() => {
      startLoading(async () => {
        try {
          const res = await fetch(`/api/buscar?q=${encodeURIComponent(value)}`);
          const data = (await res.json()) as { hits?: SearchHit[] };
          setHits(data.hits ?? []);
          setCursor(0);
          setOpen(true);
        } catch {
          setHits([]);
        }
      });
    }, 220);
    return () => clearTimeout(timer);
  }, [query]);

  function go(hit: SearchHit) {
    setOpen(false);
    setQuery("");
    router.push(hit.href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => Math.min(c + 1, hits.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (event.key === "Enter" && hits[cursor]) {
      event.preventDefault();
      go(hits[cursor]);
    }
  }

  return (
    <div ref={boxRef} className={cn("relative", compact ? "w-full" : "w-full max-w-lg")}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Buscar cliente, empresa, negocio o propuesta"
          aria-label="Buscar en todo el CRM"
          className="h-10 w-full rounded-md border border-line bg-white pl-9 pr-9 text-[14px] text-ink placeholder:text-muted-light focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 [&::-webkit-search-cancel-button]:hidden"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" aria-hidden />
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setHits([]);
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted hover:bg-off-soft hover:text-ink"
            aria-label="Limpiar busqueda"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      {open && query.trim().length >= 2 ? (
        <div className="anim-in absolute left-0 right-0 top-12 z-50 max-h-[68vh] overflow-y-auto rounded-lg border border-line-soft bg-white shadow-[var(--shadow-float)] scroll-thin">
          {hits.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-[14px] font-medium text-ink">Sin resultados para “{query.trim()}”</p>
              <p className="mt-1 text-[13px] text-muted">
                Revisa la escritura o crea el registro desde el boton Nuevo.
              </p>
            </div>
          ) : (
            <ul className="py-1">
              {hits.map((hit, index) => {
                const Icon = ICONS[hit.kind];
                return (
                  <li key={`${hit.kind}-${hit.id}`}>
                    <button
                      type="button"
                      onClick={() => go(hit)}
                      onMouseEnter={() => setCursor(index)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left",
                        index === cursor ? "bg-brand-light" : "hover:bg-canvas",
                      )}
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-off-soft text-muted">
                        <Icon className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="clip-1 text-[14px] font-medium text-ink">{hit.title}</span>
                        <span className="clip-1 text-[12px] text-muted">
                          {LABELS[hit.kind]} · {hit.subtitle}
                        </span>
                      </span>
                      {hit.meta ? (
                        <span className="tnum shrink-0 text-[12px] text-muted">{hit.meta}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
