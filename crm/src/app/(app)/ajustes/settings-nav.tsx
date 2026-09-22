"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/ajustes/mi-cuenta", label: "Mi cuenta", admin: false },
  { href: "/ajustes/usuarios", label: "Usuarios", admin: true },
  { href: "/ajustes/productos", label: "Productos y servicios", admin: true },
  { href: "/ajustes/pipeline", label: "Pipeline", admin: true },
  { href: "/ajustes/fuentes", label: "Fuentes", admin: true },
  { href: "/ajustes/campanas", label: "Campañas", admin: true },
  { href: "/ajustes/correo", label: "Correo", admin: false },
  { href: "/ajustes/notificaciones", label: "Notificaciones", admin: true },
  { href: "/ajustes/importar", label: "Importar datos", admin: false },
  { href: "/ajustes/finanzas", label: "Configuración financiera", admin: true },
];

export function SettingsNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = ITEMS.filter((item) => !item.admin || isAdmin);

  return (
    <nav aria-label="Secciones de ajustes" className="min-w-0">
      {/* En movil es una fila desplazable; en escritorio una lista vertical. */}
      <ul className="scroll-thin relative -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:px-0 lg:pb-0">
        {items.map((item) => {
          const active = pathname === item.href || (pathname === "/ajustes" && item.href === "/ajustes/mi-cuenta");
          return (
            <li key={item.href} className="shrink-0 lg:shrink">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block whitespace-nowrap rounded-md px-3 py-2 text-[14px] font-medium transition-colors lg:whitespace-normal",
                  active ? "bg-ink text-white" : "text-muted hover:bg-canvas hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
