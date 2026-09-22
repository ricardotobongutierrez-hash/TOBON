import * as React from "react";
import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

/** Foto si existe, iniciales si no. El color se deriva del nombre y es estable. */
const TONES = [
  "bg-ink text-white",
  "bg-brand text-white",
  "bg-brand-dark text-white",
  "bg-muted text-white",
  "bg-accent text-ink",
];

export function Avatar({
  name,
  photoUrl,
  size = "md",
  className,
}: {
  name: string;
  photoUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    xs: "size-5 text-[9px]",
    sm: "size-7 text-[11px]",
    md: "size-9 text-[12px]",
    lg: "size-14 text-base",
  }[size];

  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  const tone = TONES[hash % TONES.length]!;

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        className={cn("shrink-0 rounded-full object-cover", sizes, className)}
      />
    );
  }

  return (
    <span
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full font-semibold",
        sizes,
        tone,
        className,
      )}
      title={name}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
