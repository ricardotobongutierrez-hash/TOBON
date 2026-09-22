"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/brand/wordmark";
import { cn } from "@/lib/utils";
import { NAV, SETTINGS_ITEM, isActive, type NavCounts } from "./nav";

export function Sidebar({ logo, counts }: { logo: string | null; counts: NavCounts }) {
  const pathname = usePathname();

  return (
    <aside className="no-print hidden w-60 shrink-0 flex-col border-r border-ink/10 bg-ink lg:flex">
      <div className="px-5 py-5">
        <Link href="/" className="block rounded-md focus-visible:outline-offset-4" aria-label="Inicio">
          <Wordmark asset={logo} variant="claro" size="md" />
        </Link>
      </div>

      <nav className="flex-1 px-2.5 py-2" aria-label="Navegación principal">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const badge = item.countKey ? counts[item.countKey] : 0;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2.5 text-[14px] font-medium transition-colors",
                    active
                      ? "bg-white/12 text-white"
                      : "text-white/65 hover:bg-white/8 hover:text-white",
                  )}
                >
                  <item.icon className="size-[18px] shrink-0" aria-hidden />
                  <span className="clip-1 flex-1">{item.label}</span>
                  {badge > 0 ? (
                    <span
                      className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-ink"
                      title={`${badge} sin atender`}
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/10 px-2.5 py-3">
        <Link
          href={SETTINGS_ITEM.href}
          aria-current={isActive(pathname, SETTINGS_ITEM.href) ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2.5 text-[14px] font-medium transition-colors",
            isActive(pathname, SETTINGS_ITEM.href)
              ? "bg-white/12 text-white"
              : "text-white/60 hover:bg-white/8 hover:text-white",
          )}
        >
          <SETTINGS_ITEM.icon className="size-[18px] shrink-0" aria-hidden />
          <span>{SETTINGS_ITEM.label}</span>
        </Link>
      </div>
    </aside>
  );
}
