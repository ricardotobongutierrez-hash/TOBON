import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarCheck,
  CircleDot,
  ExternalLink,
  FileText,
  Mail,
  MessageCircle,
  Phone,
  Receipt,
  StickyNote,
  Users2,
  Wallet,
} from "lucide-react";
import { INTERACTION_KIND_LABEL, type Currency, type InteractionKind } from "@/db/enums";
import { formatMoney } from "@/lib/money";
import { formatDayMonth, formatTime, toDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Empty } from "@/components/ui/empty";
import type { TimelineEntry } from "@/server/queries/timeline";

const ICONS: Record<string, typeof Mail> = {
  whatsapp: MessageCircle,
  email: Mail,
  llamada: Phone,
  reunion: Users2,
  nota: StickyNote,
  tarea: CalendarCheck,
  propuesta: FileText,
  factura: Receipt,
  pago: Wallet,
  servicio: CalendarCheck,
  estado: CircleDot,
};

const TONES: Record<string, string> = {
  whatsapp: "bg-ok-soft text-ok",
  email: "bg-brand-light text-brand-dark",
  llamada: "bg-accent-soft text-brand-dark",
  reunion: "bg-brand-light text-brand-dark",
  nota: "bg-off-soft text-muted",
  tarea: "bg-off-soft text-muted",
  propuesta: "bg-warn-soft text-warn",
  factura: "bg-warn-soft text-warn",
  pago: "bg-ok-soft text-ok",
  servicio: "bg-brand-light text-brand-dark",
  estado: "bg-off-soft text-muted",
};

/**
 * Una sola linea de tiempo por cliente. Se baja con el dedo y se entiende toda
 * la relacion: mensajes, correos, llamadas, propuestas, facturas y pagos.
 */
export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return (
      <Empty
        icon={StickyNote}
        title="Todavía no hay actividad"
        message="Cuando registres una llamada, una reunión o una nota, aparece aquí en orden."
      />
    );
  }

  // Se agrupa por dia para no repetir la fecha en cada evento.
  const groups: { day: string; label: string; items: TimelineEntry[] }[] = [];
  for (const entry of entries) {
    const date = toDate(entry.occurredAt);
    const day = date ? date.toISOString().slice(0, 10) : "sin-fecha";
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(entry);
    else groups.push({ day, label: formatDayMonth(entry.occurredAt), items: [entry] });
  }

  return (
    <ol className="px-4 py-2 sm:px-5">
      {groups.map((group) => (
        <li key={group.day} className="flex gap-3 sm:gap-4">
          <div className="w-12 shrink-0 pt-3.5 sm:w-14">
            <span className="eyebrow block leading-none">{group.label}</span>
          </div>
          <ul className="min-w-0 flex-1 border-l border-line-soft pb-1 pl-4 sm:pl-5">
            {group.items.map((entry) => {
              const Icon = ICONS[entry.kind] ?? CircleDot;
              const tone = TONES[entry.kind] ?? "bg-off-soft text-muted";
              return (
                <li key={entry.id} className="relative py-3">
                  <span
                    className={cn(
                      "absolute -left-[33px] flex size-6 items-center justify-center rounded-full ring-3 ring-white sm:-left-[41px]",
                      tone,
                    )}
                    aria-hidden
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="min-w-0 break-anywhere text-[14px] font-medium leading-snug text-ink">
                      {entry.title}
                    </p>
                    {entry.direction === "entrada" ? (
                      <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-ok">
                        <ArrowDownLeft className="size-3" aria-hidden />
                        recibido
                      </span>
                    ) : entry.direction === "salida" ? (
                      <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-brand">
                        <ArrowUpRight className="size-3" aria-hidden />
                        enviado
                      </span>
                    ) : null}
                  </div>

                  {entry.amount && Number(entry.amount) !== 0 ? (
                    <p className="tnum mt-0.5 text-[14px] font-semibold text-ink">
                      {formatMoney(entry.amount, (entry.currency as Currency) ?? "COP")}
                    </p>
                  ) : null}

                  {entry.body ? (
                    <p className="mt-1 break-anywhere text-[13px] leading-relaxed text-muted">{entry.body}</p>
                  ) : null}

                  <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px] text-muted-light">
                    <span>{INTERACTION_KIND_LABEL[entry.kind as InteractionKind] ?? entry.kind}</span>
                    <span aria-hidden>·</span>
                    <span>{formatTime(entry.occurredAt)}</span>
                    {entry.userName ? (
                      <>
                        <span aria-hidden>·</span>
                        <span className="clip-1 max-w-32">{entry.userName}</span>
                      </>
                    ) : null}
                    {entry.externalUrl ? (
                      <a
                        href={entry.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-brand hover:text-brand-dark"
                      >
                        Abrir en Gmail
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ol>
  );
}
