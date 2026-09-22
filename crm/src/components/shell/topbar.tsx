"use client";

import Link from "next/link";
import { Search, X } from "lucide-react";
import { useState } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { GlobalSearch } from "@/components/search/global-search";
import { QuickActions } from "@/components/quick/quick-actions";
import { UserMenu } from "./user-menu";
import type { SessionUser } from "@/lib/auth";
import type { Pickers, Refs } from "@/server/queries/refs";

export function Topbar({
  user,
  logo,
  refs,
  pickers,
}: {
  user: SessionUser;
  logo: string | null;
  refs: Refs;
  pickers: Pickers;
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="no-print sticky top-0 z-30 border-b border-line-soft bg-white/95 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
        {/* En movil el logo va aqui; en escritorio vive en la barra lateral. */}
        <Link href="/" className="shrink-0 lg:hidden" aria-label="Inicio">
          <Wordmark asset={logo} size="sm" />
        </Link>

        <div className="hidden flex-1 lg:block">
          <GlobalSearch />
        </div>

        <div className="flex flex-1 items-center justify-end gap-2 lg:flex-none">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="rounded-md p-2 text-muted transition-colors hover:bg-canvas hover:text-ink lg:hidden"
            aria-label="Buscar"
          >
            <Search className="size-5" />
          </button>
          <QuickActions refs={refs} pickers={pickers} />
          <UserMenu user={user} />
        </div>
      </div>

      {searchOpen ? (
        <div className="anim-in border-t border-line-soft bg-white px-4 py-3 lg:hidden">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <GlobalSearch compact />
            </div>
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="shrink-0 rounded-md p-2 text-muted hover:bg-canvas"
              aria-label="Cerrar busqueda"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>
      ) : null}
    </header>
  );
}
