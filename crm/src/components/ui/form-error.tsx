import { AlertCircle } from "lucide-react";

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-md border border-danger/25 bg-danger-soft px-3 py-2.5 text-[13px] text-danger"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p className="leading-relaxed break-anywhere">{message}</p>
    </div>
  );
}
