import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { contacts, opportunities, proposals } from "@/db/schema";
import { getStages } from "@/lib/pipeline";
import { followUpSettings, financeSettings } from "@/lib/settings";
import { toNumber } from "@/lib/money";
import { daysBetween } from "@/lib/dates";

/**
 * Inteligencia comercial.
 *
 * Todo lo que se muestra sale de los datos del CRM y viene con la cifra y el
 * registro que lo respalda. No hay consejos genericos de motivacion.
 *
 * La capa de lenguaje es opcional: si hay ANTHROPIC_API_KEY, el resumen se
 * redacta con Claude a partir de estos mismos hallazgos. Sin la clave, los
 * hallazgos se muestran igual, calculados aqui.
 */
export const AI_AVAILABLE = Boolean(process.env.ANTHROPIC_API_KEY);
export const AI_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

export type Insight = {
  key: string;
  severity: "critico" | "atencion" | "informativo";
  title: string;
  detail: string;
  /** El dato concreto que respalda el hallazgo. Sin esto no se muestra. */
  evidence: string;
  href: string;
  amountCop?: number;
};

export async function commercialInsights(): Promise<Insight[]> {
  const db = await getDb();
  const cfg = await followUpSettings();
  const { usdRate } = await financeSettings();
  const stages = await getStages();
  const activeSlugs = new Set(stages.filter((s) => s.kind === "activa").map((s) => s.slug));
  const cop = (amount: string, currency: string) =>
    toNumber(amount) * (currency === "USD" ? usdRate : 1);

  const insights: Insight[] = [];

  const opps = await db
    .select({
      id: opportunities.id,
      name: opportunities.name,
      amount: opportunities.amount,
      currency: opportunities.currency,
      stage: opportunities.stage,
      stageChangedAt: opportunities.stageChangedAt,
      lastInteractionAt: opportunities.lastInteractionAt,
      createdAt: opportunities.createdAt,
      paymentStatus: opportunities.paymentStatus,
      lostReason: opportunities.lostReason,
      nextAction: sql<string | null>`(
        select title from tasks
        where tasks.opportunity_id = ${opportunities.id}
          and tasks.status = 'abierta' and tasks.deleted_at is null
        limit 1
      )`,
    })
    .from(opportunities)
    .where(isNull(opportunities.deletedAt));

  const active = opps.filter((o) => activeSlugs.has(o.stage));

  // 1. Negocios de alto valor descuidados: es la fuga mas caraven.
  const neglected = active
    .filter((o) => {
      const value = cop(o.amount, o.currency);
      const silent = daysBetween(o.lastInteractionAt ?? o.createdAt);
      return value >= cfg.highValueCop && silent >= 7;
    })
    .sort((a, b) => cop(b.amount, b.currency) - cop(a.amount, a.currency));

  for (const opp of neglected.slice(0, 3)) {
    const silent = daysBetween(opp.lastInteractionAt ?? opp.createdAt);
    insights.push({
      key: `descuidado:${opp.id}`,
      severity: silent >= 14 ? "critico" : "atencion",
      title: `${opp.name} lleva ${silent} dias sin contacto`,
      detail: "Es uno de los negocios más grandes del pipeline y está quieto. Una llamada hoy vale más que tres correos la semana entrante.",
      evidence: `Valor ${Math.round(cop(opp.amount, opp.currency)).toLocaleString("es-CO")} COP · ultimo contacto hace ${silent} dias`,
      href: `/negocios/${opp.id}`,
      amountCop: cop(opp.amount, opp.currency),
    });
  }

  // 2. Negocios activos sin siguiente accion.
  const noNext = active.filter((o) => !o.nextAction);
  if (noNext.length > 0) {
    const total = noNext.reduce((a, o) => a + cop(o.amount, o.currency), 0);
    insights.push({
      key: "sin-accion",
      severity: total >= cfg.highValueCop ? "critico" : "atencion",
      title: `${noNext.length} ${noNext.length === 1 ? "negocio activo" : "negocios activos"} sin proxima accion`,
      detail: "Un negocio sin siguiente paso agendado no avanza solo. Es lo más rápido de corregir.",
      evidence: `${Math.round(total).toLocaleString("es-CO")} COP en juego`,
      href: "/negocios?filtro=sin-accion",
      amountCop: total,
    });
  }

  // 3. Propuestas estancadas.
  const stalled = await db
    .select({
      id: proposals.id,
      number: proposals.number,
      title: proposals.title,
      amount: proposals.amount,
      currency: proposals.currency,
      sentAt: proposals.sentAt,
      opportunityId: proposals.opportunityId,
    })
    .from(proposals)
    .where(
      and(
        isNull(proposals.deletedAt),
        isNull(proposals.respondedAt),
        sql`${proposals.status} in ('enviada', 'en-revision')`,
      ),
    );

  const veryStalled = stalled
    .filter((p) => p.sentAt && daysBetween(p.sentAt) >= 7)
    .sort((a, b) => daysBetween(a.sentAt) - daysBetween(b.sentAt))
    .reverse();

  if (veryStalled.length > 0) {
    const total = veryStalled.reduce((a, p) => a + cop(p.amount, p.currency), 0);
    const oldest = veryStalled[0]!;
    insights.push({
      key: "propuestas-estancadas",
      severity: daysBetween(oldest.sentAt) >= 14 ? "critico" : "atencion",
      title: `${veryStalled.length} ${veryStalled.length === 1 ? "propuesta" : "propuestas"} sin respuesta hace mas de una semana`,
      detail: "Después de dos semanas la probabilidad de cierre cae. Vale la pena llamar en vez de esperar otro correo.",
      evidence: `La mas antigua es ${oldest.number}, enviada hace ${daysBetween(oldest.sentAt)} dias · ${Math.round(total).toLocaleString("es-CO")} COP en total`,
      href: "/negocios?pestana=propuestas",
      amountCop: total,
    });
  }

  // 4. Motivos de perdida que se repiten.
  const lost = opps.filter((o) => stages.find((s) => s.slug === o.stage)?.kind === "perdido" && o.lostReason);
  if (lost.length >= 2) {
    const byReason = new Map<string, number>();
    for (const o of lost) byReason.set(o.lostReason!, (byReason.get(o.lostReason!) ?? 0) + 1);
    const [reason, count] = Array.from(byReason.entries()).sort((a, b) => b[1] - a[1])[0]!;
    if (count >= 2) {
      insights.push({
        key: "motivo-perdida",
        severity: "informativo",
        title: `"${reason}" es el motivo de perdida mas frecuente`,
        detail: "Cuando un motivo se repite, casi nunca es el precio: es como se esta presentando el valor antes de hablar de plata.",
        evidence: `${count} de ${lost.length} negocios perdidos`,
        href: "/reportes",
      });
    }
  }

  // 5. Calidad de las fuentes: cual trae leads que de verdad cierran.
  const bySource = await db
    .select({
      source: sql<string>`coalesce(ls.name, 'Sin definir')`,
      leads: sql<number>`count(*)::int`,
      clientes: sql<number>`count(*) filter (where ${contacts.status} = 'cliente')::int`,
    })
    .from(contacts)
    .leftJoin(sql`lead_sources ls`, sql`ls.id = ${contacts.sourceId}`)
    .where(isNull(contacts.deletedAt))
    .groupBy(sql`coalesce(ls.name, 'Sin definir')`);

  const meaningful = bySource.filter((s) => s.leads >= 3);
  if (meaningful.length >= 2) {
    const best = meaningful.reduce((a, b) => (b.clientes / b.leads > a.clientes / a.leads ? b : a));
    if (best.clientes > 0) {
      insights.push({
        key: "mejor-fuente",
        severity: "informativo",
        title: `${best.source} es la fuente que mas convierte`,
        detail: "Vale la pena revisar si se le puede dar más presupuesto o más atención a ese canal.",
        evidence: `${best.clientes} clientes de ${best.leads} leads`,
        href: "/reportes",
      });
    }
  }

  // 6. Cobros vencidos.
  const overduePayments = active.filter((o) => o.paymentStatus === "vencido");
  if (overduePayments.length > 0) {
    insights.push({
      key: "cobros-vencidos",
      severity: "critico",
      title: `${overduePayments.length} ${overduePayments.length === 1 ? "negocio" : "negocios"} con pago vencido`,
      detail: "Un cobro vencido que nadie persigue se vuelve una pérdida silenciosa.",
      evidence: "Revisa Finanzas para ver el detalle por cliente",
      href: "/finanzas?kpi=vencidos",
    });
  }

  const order = { critico: 0, atencion: 1, informativo: 2 };
  return insights.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 8);
}

/**
 * Redacta un resumen corto de los hallazgos con Claude, si hay clave.
 * El modelo solo reformula: los hechos vienen calculados de la base.
 */
export async function summarizeInsights(insights: Insight[]): Promise<string | null> {
  if (!AI_AVAILABLE || insights.length === 0) return null;

  const facts = insights
    .map((i) => `- [${i.severity}] ${i.title}. ${i.evidence}`)
    .join("\n");

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 400,
        system:
          "Eres el asistente comercial interno de José I. Tobón, Expertos en Negociación. " +
          "Escribe en español, se tutea siempre, nunca usted. Registro analítico y directo, sin lenguaje de influencer. " +
          "Cero rayas largas: usa comas o dos puntos. No empieces frases con Y ni con Pero. " +
          "Solo puedes usar los hechos que te doy. No inventes cifras, fechas, nombres de clientes ni porcentajes. " +
          "Máximo tres frases, en un solo párrafo, diciendo que hacer primero hoy.",
        messages: [
          {
            role: "user",
            content: `Estos son los hallazgos del CRM de hoy:\n\n${facts}\n\nResume que hay que atender primero.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[ai]", response.status, await response.text());
      return null;
    }
    const data = (await response.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((block) => block.type === "text")?.text;
    return text?.trim() ?? null;
  } catch (err) {
    console.error("[ai]", err);
    return null;
  }
}
