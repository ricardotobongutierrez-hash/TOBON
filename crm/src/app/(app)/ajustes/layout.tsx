import { requireUser } from "@/lib/auth";
import { SettingsNav } from "./settings-nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-[1200px]">
      <div className="mb-5">
        <h1 className="text-[22px] font-semibold leading-tight text-ink sm:text-[25px]">Ajustes</h1>
        <p className="mt-1 text-[14px] text-muted">
          Configuración del sistema. Las acciones del día a día no viven aquí.
        </p>
      </div>
      {/* grid-cols-1 es minmax(0,1fr): sin eso la barra desplazable de
          secciones estira la columna y la pagina se desplaza en horizontal. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <SettingsNav isAdmin={user.role === "admin"} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
