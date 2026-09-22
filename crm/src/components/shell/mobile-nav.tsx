"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CircleDollarSign, Handshake, Home, ListChecks, PieChart, Settings, Users, X } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { isActive, type NavCounts } from "./nav";

/**
 * En movil se priorizan las cuatro pantallas del dia a dia y el resto entra por
 * "Mas". No es la barra lateral encogida: es otra disposicion.
 */
const PRIMARY = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/pendientes", label: "Pendientes", icon: ListChecks, countKey: "pendientes" as const },
  { href: "/contactos", label: "Contactos", icon: Users },
  { href: "/negocios", label: "Negocios", icon: Handshake },
];

const SECONDARY = [
  { href: "/empresas", label: "Empresas", icon: Building2 },
  { href: "/finanzas", label: "Finanzas", icon: CircleDollarSign },
  { href: "/reportes", label: "Reportes", icon: PieChart },
  { href: "/ajustes", label: "Ajustes", icon: Settings },
];

export function MobileNav({ counts }: { counts: NavCounts }) {
  const pathname = usePathname();
  const moreActive = SECONDARY.some((i) => isActive(pathname, i.href));

  return (
    <nav
      className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t border-line-soft bg-white/97 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Navegación"
    >
      {PRIMARY.map((item) => {
        const active = isActive(pathname, item.href);
        const badge = item.countKey ? counts[item.countKey] : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
              active ? "text-brand" : "text-muted",
            )}
          >
            <span className="relative">
              <item.icon className="size-[21px]" aria-hidden />
              {badge > 0 ? (
                <span className="absolute -right-2 -top-1 min-w-4 rounded-full bg-danger px-1 text-center text-[9px] font-semibold leading-4 text-white">
                  {badge > 9 ? "9+" : badge}
                </span>
              ) : null}
            </span>
            <span>{item.label}</span>
          </Link>
        );
      })}

      <Dialog.Root>
        <Dialog.Trigger
          className={cn(
            "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
            moreActive ? "text-brand" : "text-muted",
          )}
        >
          <svg className="size-[21px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" />
          </svg>
          <span>Más</span>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30" />
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-lg bg-white pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-float)]">
            <div className="flex items-center justify-between border-b border-line-soft px-4 py-3">
              <Dialog.Title className="text-[15px] font-semibold text-ink">Más secciones</Dialog.Title>
              <Dialog.Close className="rounded-md p-1.5 text-muted hover:bg-off-soft" aria-label="Cerrar">
                <X className="size-5" />
              </Dialog.Close>
            </div>
            <ul className="p-2">
              {SECONDARY.map((item) => (
                <li key={item.href}>
                  <Dialog.Close asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-3 text-[15px] font-medium",
                        isActive(pathname, item.href) ? "bg-brand-light text-brand-dark" : "text-ink hover:bg-canvas",
                      )}
                    >
                      <item.icon className="size-5 shrink-0" aria-hidden />
                      {item.label}
                    </Link>
                  </Dialog.Close>
                </li>
              ))}
            </ul>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </nav>
  );
}
