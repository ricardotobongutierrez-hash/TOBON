import Link from "next/link";
import type { Metadata } from "next";
import {
  CheckCircle2,
  Clock,
  CalendarClock,
  FileText,
  Hourglass,
  Wallet,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listTasks } from "@/server/queries/lists";
import { loadPickers, loadRefs } from "@/server/queries/refs";
import { endOfDay, startOfDay } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { PageHeader } from "@/components/ui/page-header";
import { ScopeToggle } from "@/components/ui/scope-toggle";
import { TaskList } from "./task-list";
import { NewTaskButton } from "./new-task-button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Pendientes" };

type SectionKey = "vencidos" | "hoy" | "proximos" | "esperando-cliente" | "esperando-propuesta" | "esperando-pago";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; seccion?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope = sp.vista === "equipo" ? "equipo" : "mios";
  const [refs, pickers] = await Promise.all([loadRefs(), loadPickers()]);

  const all = await listTasks({
    responsibleId: scope === "mios" ? user.id : undefined,
    status: "abierta",
    limit: 600,
  });

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);

  const sections: {
    key: SectionKey;
    title: string;
    help: string;
    icon: typeof Clock;
    tone: "critico" | "marca" | "neutro" | "atencion";
    rows: typeof all;
  }[] = [
    {
      key: "vencidos",
      title: "Vencidos",
      help: "Se pasó la fecha. Es lo primero del día.",
      icon: Clock,
      tone: "critico",
      rows: all.filter((t) => t.dueAt && t.dueAt < todayStart),
    },
    {
      key: "hoy",
      title: "Hoy",
      help: "Lo que toca hoy.",
      icon: CalendarClock,
      tone: "marca",
      rows: all.filter((t) => t.dueAt && t.dueAt >= todayStart && t.dueAt <= todayEnd),
    },
    {
      key: "proximos",
      title: "Próximos",
      help: "Lo que viene después de hoy.",
      icon: Hourglass,
      tone: "neutro",
      rows: all.filter((t) => !t.dueAt || t.dueAt > todayEnd),
    },
    {
      key: "esperando-cliente",
      title: "Esperando al cliente",
      help: "La pelota esta del otro lado, pero igual hay que hacer seguimiento.",
      icon: Hourglass,
      tone: "atencion",
      rows: all.filter((t) => t.waitingFor === "cliente"),
    },
    {
      key: "esperando-propuesta",
      title: "Esperando respuesta de propuesta",
      help: "Propuestas enviadas sin respuesta.",
      icon: FileText,
      tone: "atencion",
      rows: all.filter((t) => t.waitingFor === "propuesta"),
    },
    {
      key: "esperando-pago",
      title: "Esperando pago",
      help: "Facturas y cuotas por cobrar.",
      icon: Wallet,
      tone: "atencion",
      rows: all.filter((t) => t.waitingFor === "pago"),
    },
  ];

  const focus = sp.seccion as SectionKey | undefined;
  const shown = focus ? sections.filter((s) => s.key === focus) : sections;

  function sectionHref(key: SectionKey | null) {
    const next = new URLSearchParams();
    if (scope === "equipo") next.set("vista", "equipo");
    if (key) next.set("seccion", key);
    return `/pendientes${next.toString() ? `?${next}` : ""}`;
  }

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        title="Pendientes"
        description={
          scope === "mios"
            ? "Todo lo tuyo, agrupado por urgencia."
            : "Todos los pendientes del equipo, agrupados por urgencia."
        }
        action={
          <>
            <ScopeToggle />
            <NewTaskButton refs={refs} pickers={pickers} />
          </>
        }
      />

      {/* Atajos de seccion, con el conteo a la vista */}
      <div className="no-print scroll-thin relative -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <Link
          href={sectionHref(null)}
          className={cn(
            "shrink-0 rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors",
            !focus ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:text-ink",
          )}
        >
          Todo ({all.length})
        </Link>
        {sections.map((section) => (
          <Link
            key={section.key}
            href={sectionHref(section.key)}
            className={cn(
              "shrink-0 rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors",
              focus === section.key
                ? "border-ink bg-ink text-white"
                : section.rows.length > 0 && section.tone === "critico"
                  ? "border-danger/30 bg-danger-soft text-danger hover:border-danger/60"
                  : "border-line bg-white text-muted hover:text-ink",
            )}
          >
            {section.title} ({section.rows.length})
          </Link>
        ))}
      </div>

      {all.length === 0 ? (
        <Card>
          <Empty
            icon={CheckCircle2}
            tone="bueno"
            title="No tienes pendientes abiertos"
            message={
              scope === "mios"
                ? "Todo está al día. Revisa lo del equipo o abre el pipeline para buscar el siguiente paso."
                : "El equipo completo está al día con los seguimientos."
            }
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <NewTaskButton refs={refs} pickers={pickers} />
                <Button variant="outline" asChild>
                  <Link href="/negocios">Abrir el pipeline</Link>
                </Button>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="space-y-5">
          {shown.map((section) => (
            <Card key={section.key} className="overflow-hidden">
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <section.icon
                      className={cn(
                        "size-4 shrink-0",
                        section.tone === "critico"
                          ? "text-danger"
                          : section.tone === "marca"
                            ? "text-brand"
                            : section.tone === "atencion"
                              ? "text-warn"
                              : "text-muted",
                      )}
                      aria-hidden
                    />
                    {section.title}
                    <span className="tnum text-[13px] font-normal text-muted">({section.rows.length})</span>
                  </span>
                }
                description={section.help}
              />
              {section.rows.length === 0 ? (
                <Empty
                  tone={section.tone === "critico" ? "bueno" : "neutro"}
                  title={
                    section.key === "vencidos"
                      ? "Nada vencido"
                      : section.key === "hoy"
                        ? "Nada para hoy"
                        : `Nada en ${section.title.toLowerCase()}`
                  }
                  message={
                    section.key === "vencidos"
                      ? "Todos los seguimientos están al día."
                      : "Cuando aparezca algo en esta sección, se muestra aquí."
                  }
                  className="py-8"
                />
              ) : (
                <TaskList rows={section.rows} />
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
