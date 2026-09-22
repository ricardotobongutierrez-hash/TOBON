import {
  Building2,
  CircleDollarSign,
  Handshake,
  Home,
  ListChecks,
  PieChart,
  Settings,
  Users,
} from "lucide-react";

/**
 * Navegacion principal. Son siete destinos y Ajustes aparte. No hay menus
 * anidados: si algo no cabe aqui, vive dentro de una de estas pantallas.
 */
export type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  /** Que se responde en esta pantalla. Se muestra como ayuda. */
  hint: string;
  countKey?: "pendientes" | "propuestas" | "cobros";
};

export const NAV: NavItem[] = [
  { href: "/", label: "Inicio", icon: Home, hint: "Qué hay que hacer hoy" },
  { href: "/contactos", label: "Contactos", icon: Users, hint: "Personas" },
  { href: "/empresas", label: "Empresas", icon: Building2, hint: "Organizaciones" },
  { href: "/negocios", label: "Negocios", icon: Handshake, hint: "Pipeline y propuestas" },
  { href: "/pendientes", label: "Pendientes", icon: ListChecks, hint: "Seguimientos", countKey: "pendientes" },
  { href: "/finanzas", label: "Finanzas", icon: CircleDollarSign, hint: "Cobros y facturas", countKey: "cobros" },
  { href: "/reportes", label: "Reportes", icon: PieChart, hint: "Resultados" },
];

export const SETTINGS_ITEM: NavItem = {
  href: "/ajustes",
  label: "Ajustes",
  icon: Settings,
  hint: "Usuarios, productos y correo",
};

export type NavCounts = { pendientes: number; propuestas: number; cobros: number };

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
