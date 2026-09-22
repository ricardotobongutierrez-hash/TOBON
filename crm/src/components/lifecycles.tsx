import { billingChip, deliveryChip, paymentChip, proposalChip, stageChip } from "@/lib/status";
import type {
  BillingStatus,
  DeliveryStatus,
  PaymentStatus,
  ProposalStatus,
  StageKind,
} from "@/db/enums";
import { Badge } from "@/components/ui/badge";

/**
 * Los cinco ciclos de vida de un negocio, separados y a la vista.
 *
 * Un solo campo gigante de estado obligaria a elegir entre "ganado" y "pago
 * pendiente", que son cosas distintas y verdaderas al mismo tiempo.
 */
export function Lifecycles({
  stageName,
  stageKind,
  proposalStatus,
  billingStatus,
  paymentStatus,
  deliveryStatus,
  compact = false,
}: {
  stageName: string;
  stageKind: StageKind;
  proposalStatus: ProposalStatus;
  billingStatus: BillingStatus;
  paymentStatus: PaymentStatus;
  deliveryStatus: DeliveryStatus;
  compact?: boolean;
}) {
  const items = [
    { label: "Venta", chip: stageChip(stageName, stageKind) },
    { label: "Propuesta", chip: proposalChip(proposalStatus) },
    { label: "Facturación", chip: billingChip(billingStatus) },
    { label: "Pago", chip: paymentChip(paymentStatus) },
    { label: "Entrega", chip: deliveryChip(deliveryStatus) },
  ];

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Badge key={item.label} tone={item.chip.tone} size="sm" dot>
            {item.chip.label}
          </Badge>
        ))}
      </div>
    );
  }

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="eyebrow">{item.label}</dt>
          <dd className="mt-1.5">
            <Badge tone={item.chip.tone} dot>
              {item.chip.label}
            </Badge>
          </dd>
        </div>
      ))}
    </dl>
  );
}
