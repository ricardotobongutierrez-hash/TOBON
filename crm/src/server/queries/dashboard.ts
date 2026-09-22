import "server-only";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { interactions, opportunities, payments, proposals, serviceDeliveries } from "@/db/schema";
import { getStages } from "@/lib/pipeline";
import { toNumber } from "@/lib/money";
import { financeSettings, followUpSettings } from "@/lib/settings";
import { addDays, endOfDay, endOfMonth, formatDateInput, startOfDay, startOfMonth } from "@/lib/dates";
import { listOpportunities, listTasks, type TaskRow } from "./lists";

/**
 * Inicio no es un tablero de BI: es el centro de mando del dia. Todo lo que se
 * calcula aqui responde a una pregunta operativa concreta.
 */
export type Priority = {
  id: string;
  clientName: string;
  clientHref: string;
  situation: string;
  action: string;
  dueAt: Date | null;
  responsibleName: string | null;
  amount: string | null;
  currency: string | null;
  urgency: "vencido" | "hoy" | "proximo";
  taskId: string | null;
};

export async function homeData(userId: string, scope: "mios" | "equipo") {
  const db = await getDb();
  const responsibleId = scope === "mios" ? userId : undefined;
  const today = new Date();
  const dayEnd = endOfDay(today);
  const cfg = await followUpSettings();
  const { usdRate } = await financeSettings();
  const stages = await getStages();
  const activeSlugs = new Set(stages.filter((s) => s.kind === "activa").map((s) => s.slug));

  const openTasks = await listTasks({ responsibleId, status: "abierta", limit: 500 });
  const overdue = openTasks.filter((t) => t.dueAt && t.dueAt < startOfDay(today));
  const dueToday = openTasks.filter((t) => t.dueAt && t.dueAt >= startOfDay(today) && t.dueAt <= dayEnd);
  const upcoming = openTasks.filter((t) => t.dueAt && t.dueAt > dayEnd);
  const waitingClient = openTasks.filter((t) => t.waitingFor === "cliente");
  const waitingProposal = openTasks.filter((t) => t.waitingFor === "propuesta");
  const waitingPayment = openTasks.filter((t) => t.waitingFor === "pago");

  // Reuniones y servicios de hoy.
  const meetingsToday = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(serviceDeliveries)
    .where(
      and(
        isNull(serviceDeliveries.deletedAt),
        sql`${serviceDeliveries.scheduledAt} >= ${startOfDay(today)}`,
        sql`${serviceDeliveries.scheduledAt} <= ${dayEnd}`,
      ),
    );
  const meetingTasksToday = dueToday.filter((t) => t.kind === "agendar-reunion").length;

  // Propuestas esperando respuesta.
  const pendingProposals = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(proposals)
    .where(
      and(
        isNull(proposals.deletedAt),
        sql`${proposals.status} in ('enviada', 'en-revision', 'cambios-solicitados', 'lista-para-enviar')`,
      ),
    );

  // Clientes que escribieron y no tienen respuesta nuestra despues.
  const unanswered = await db
    .select({
      contactId: interactions.contactId,
      last: sql<Date>`max(${interactions.occurredAt})`,
    })
    .from(interactions)
    .where(and(eq(interactions.direction, "entrada"), sql`${interactions.contactId} is not null`))
    .groupBy(interactions.contactId);

  const outboundLast = await db
    .select({
      contactId: interactions.contactId,
      last: sql<Date>`max(${interactions.occurredAt})`,
    })
    .from(interactions)
    .where(and(eq(interactions.direction, "salida"), sql`${interactions.contactId} is not null`))
    .groupBy(interactions.contactId);

  const outboundMap = new Map(outboundLast.map((r) => [r.contactId, new Date(r.last)]));
  const toAnswer = unanswered.filter((r) => {
    const out = outboundMap.get(r.contactId);
    return !out || out < new Date(r.last);
  }).length;

  // Pagos pendientes
  const pendingPayments = await db
    .select({ n: sql<number>`count(*)::int`, total: sql<string>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(and(isNull(payments.deletedAt), isNull(payments.paidOn), sql`${payments.status} <> 'reembolsado'`));

  const overduePayments = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(payments)
    .where(
      and(
        isNull(payments.deletedAt),
        isNull(payments.paidOn),
        lt(payments.expectedOn, formatDateInput(today)),
        sql`${payments.status} <> 'reembolsado'`,
      ),
    );

  const paidThisMonth = await db
    .select({ total: sql<string>`coalesce(sum(${payments.amount}), 0)` })
    .from(payments)
    .where(
      and(
        isNull(payments.deletedAt),
        sql`${payments.paidOn} >= ${formatDateInput(startOfMonth(today))}`,
        sql`${payments.paidOn} <= ${formatDateInput(endOfMonth(today))}`,
        sql`${payments.status} <> 'reembolsado'`,
      ),
    );

  // Pipeline
  const allOpps = await listOpportunities({ responsibleId });
  const active = allOpps.filter((o) => activeSlugs.has(o.stage));
  const cop = (amount: string, currency: string) => toNumber(amount) * (currency === "USD" ? usdRate : 1);
  const pipelineTotal = active.reduce((a, o) => a + cop(o.amount, o.currency), 0);
  const pipelineWeighted = active.reduce((a, o) => a + cop(o.amount, o.currency) * (o.probability / 100), 0);
  const closingThisMonth = active.filter(
    (o) =>
      o.expectedCloseOn &&
      o.expectedCloseOn >= formatDateInput(startOfMonth(today)) &&
      o.expectedCloseOn <= formatDateInput(endOfMonth(today)),
  );

  // Regla critica: ningun negocio activo deberia existir sin siguiente accion.
  const withoutNextAction = active.filter((o) => !o.nextAction);
  const highValueNeglected = withoutNextAction.filter((o) => cop(o.amount, o.currency) >= cfg.highValueCop);

  // Silencio prolongado.
  const stale = active
    .map((o) => {
      const ref = o.lastInteractionAt ?? o.createdAt;
      const days = Math.floor((today.getTime() - new Date(ref).getTime()) / 86_400_000);
      return { ...o, silentDays: days };
    })
    .filter((o) => o.silentDays >= cfg.staleDays[0]!)
    .sort((a, b) => b.silentDays - a.silentDays);

  const priorities = buildPriorities([...overdue, ...dueToday], today);

  return {
    counters: {
      toAnswer,
      overdue: overdue.length,
      dueToday: dueToday.length,
      meetings: (meetingsToday[0]?.n ?? 0) + meetingTasksToday,
      pendingProposals: pendingProposals[0]?.n ?? 0,
      pendingPayments: pendingPayments[0]?.n ?? 0,
      overduePayments: overduePayments[0]?.n ?? 0,
    },
    money: {
      pendingCollectionCop: toNumber(pendingPayments[0]?.total ?? 0),
      paidThisMonthCop: toNumber(paidThisMonth[0]?.total ?? 0),
      pendingInvoices: await pendingInvoiceCount(),
    },
    pipeline: {
      activeCount: active.length,
      totalCop: pipelineTotal,
      weightedCop: pipelineWeighted,
      closingThisMonth: closingThisMonth.length,
      closingThisMonthCop: closingThisMonth.reduce((a, o) => a + cop(o.amount, o.currency), 0),
    },
    alerts: {
      withoutNextAction,
      highValueNeglected,
      stale: stale.slice(0, 12),
    },
    buckets: {
      overdue,
      dueToday,
      upcoming,
      waitingClient,
      waitingProposal,
      waitingPayment,
    },
    priorities,
  };
}

async function pendingInvoiceCount(): Promise<number> {
  const db = await getDb();
  const { invoices } = await import("@/db/schema");
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(invoices)
    .where(and(isNull(invoices.deletedAt), eq(invoices.status, "pendiente")));
  return row?.n ?? 0;
}

/** Traduce un pendiente a la fila de "Prioridades de hoy": que pasa y que hacer. */
function buildPriorities(tasks: TaskRow[], now: Date): Priority[] {
  const situations: Record<string, string> = {
    llamar: "Quedó pendiente una llamada",
    "enviar-informacion": "El cliente espera información",
    "enviar-propuesta": "Hay que preparar la propuesta",
    "esperar-respuesta": "Propuesta enviada sin respuesta",
    "seguimiento-pago": "Pago pendiente",
    "agendar-reunion": "Falta agendar la reunión",
    "emitir-factura": "Propuesta aceptada sin factura",
    "coordinar-servicio": "Servicio pagado sin programar",
    otro: "Seguimiento comercial",
  };

  return tasks
    .map((t) => {
      const overdue = t.dueAt ? t.dueAt < startOfDay(now) : false;
      return {
        id: t.id,
        taskId: t.id,
        clientName: t.companyName ?? t.contactName ?? t.opportunityName ?? "Sin cliente",
        clientHref: t.companyId
          ? `/empresas/${t.companyId}`
          : t.contactId
            ? `/contactos/${t.contactId}`
            : t.opportunityId
              ? `/negocios/${t.opportunityId}`
              : "/pendientes",
        situation: situations[t.kind] ?? "Seguimiento comercial",
        action: t.title,
        dueAt: t.dueAt,
        responsibleName: t.responsibleName,
        amount: t.opportunityAmount,
        currency: t.opportunityCurrency,
        urgency: (overdue ? "vencido" : "hoy") as Priority["urgency"],
      };
    })
    .sort((a, b) => {
      if (a.urgency !== b.urgency) return a.urgency === "vencido" ? -1 : 1;
      return (a.dueAt?.getTime() ?? 0) - (b.dueAt?.getTime() ?? 0);
    })
    .slice(0, 12);
}

export type HomeData = Awaited<ReturnType<typeof homeData>>;
export { addDays };
