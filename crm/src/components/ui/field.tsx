"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Etiqueta visible siempre. Nada de campos que solo se entienden por el placeholder. */
export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline gap-1.5 text-[13px] font-medium text-ink">
        <span>{label}</span>
        {required ? (
          <span className="text-danger" aria-hidden>
            *
          </span>
        ) : (
          <span className="text-[11px] font-normal text-muted-light">opcional</span>
        )}
      </label>
      {children}
      {hint && !error ? <p className="mt-1 text-[12px] text-muted">{hint}</p> : null}
      {error ? (
        <p className="mt-1 text-[12px] font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const baseInput =
  "w-full min-w-0 rounded-md border border-line bg-white px-3 text-[14px] text-ink transition-colors placeholder:text-muted-light hover:border-muted-light focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15 disabled:bg-canvas disabled:text-muted";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(baseInput, "h-10", className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(baseInput, "min-h-20 py-2 leading-relaxed", className)} {...props} />;
});

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          baseInput,
          "select-arrow h-10 cursor-pointer appearance-none pr-9",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Checkbox({
  label,
  hint,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = React.useId();
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <input
        id={props.id ?? id}
        type="checkbox"
        className="tap-target mt-px size-[18px] shrink-0 cursor-pointer rounded-xs border-line accent-[var(--color-brand)]"
        {...props}
      />
      <label htmlFor={props.id ?? id} className="cursor-pointer text-[13px] leading-snug text-ink">
        {label}
        {hint ? <span className="mt-0.5 block text-[12px] text-muted">{hint}</span> : null}
      </label>
    </div>
  );
}

/** Rejilla de formulario: una columna en movil, dos desde tablet. */
export function FieldGrid({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid gap-4 sm:grid-cols-2", className)} {...props} />;
}
