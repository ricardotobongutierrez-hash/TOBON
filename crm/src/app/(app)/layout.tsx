import { redirect } from "next/navigation";
import { and, count, eq, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { invoices, payments, tasks } from "@/db/schema";
import { currentUser } from "@/lib/auth";
import { logoAsset } from "@/lib/brand";
import { runMaintenance } from "@/lib/automation";
import { formatDateInput, endOfDay } from "@/lib/dates";
import { loadPickers, loadRefs } from "@/server/queries/refs";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { MobileNav } from "@/components/shell/mobile-nav";
import type { NavCounts } from "@/components/shell/nav";

/**
 * El barrido de mantenimiento corre aqui, como maximo una vez cada diez minutos,
 * para que los vencimientos esten al dia sin depender de un cron externo. En
 * produccion se puede apuntar un cron a /api/mantenimiento y bajar la frecuencia.
 */
let lastMaintenance = 0;
const MAINTENANCE_MS = 10 * 60 * 1000;

async function maybeMaintenance() {
  if (Date.now() - lastMaintenance < MAINTENANCE_MS) return;
  lastMaintenance = Date.now();
  try {
    await runMaintenance();
  } catch (err) {
    console.error("[mantenimiento]", err);
  }
}

async function navCounts(userId: string): Promise<NavCounts> {
  const db = await getDb();
  const today = formatDateInput(new Date());
  const [pendientes, propuestas, cobros] = await Promise.all([
    db
      .select({ n: count() })
      .from(tasks)
      .where(
        and(
          isNull(tasks.deletedAt),
          eq(tasks.status, "abierta"),
          eq(tasks.responsibleId, userId),
          lt(tasks.dueAt, endOfDay(new Date())),
        ),
      ),
    db
      .select({ n: count() })
      .from(tasks)
      .where(and(isNull(tasks.deletedAt), eq(tasks.status, "abierta"), eq(tasks.waitingFor, "propuesta"))),
    db
      .select({ n: count() })
      .from(payments)
      .where(
        and(
          isNull(payments.deletedAt),
          isNull(payments.paidOn),
          lt(payments.expectedOn, today),
          sql`${payments.status} <> 'reembolsado'`,
        ),
      ),
  ]);

  return {
    pendientes: pendientes[0]?.n ?? 0,
    propuestas: propuestas[0]?.n ?? 0,
    cobros: cobros[0]?.n ?? 0,
  };
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/ingresar");

  await maybeMaintenance();

  const [refs, pickers, counts] = await Promise.all([loadRefs(), loadPickers(), navCounts(user.id)]);
  const logo = logoAsset();

  return (
    <div className="flex min-h-dvh">
      <Sidebar logo={logo} counts={counts} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} logo={logo} refs={refs} pickers={pickers} />
        {/* El relleno inferior deja espacio para la barra de navegacion movil. */}
        <main className="min-w-0 flex-1 px-4 pb-24 pt-5 sm:px-6 sm:pt-6 lg:pb-10">{children}</main>
        <MobileNav counts={counts} />
      </div>
    </div>
  );
}
