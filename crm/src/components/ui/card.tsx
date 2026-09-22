import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-lg border border-line-soft bg-white shadow-[var(--shadow-card)]", className)}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  title,
  description,
  action,
  ...props
}: Omit<React.HTMLAttributes<HTMLDivElement>, "title"> & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-4 py-3 sm:px-5",
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">
        {title ? <h2 className="text-[15px] font-semibold text-ink">{title}</h2> : null}
        {description ? <p className="mt-0.5 text-[13px] text-muted">{description}</p> : null}
        {props.children}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 py-4 sm:px-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-2 border-t border-line-soft bg-canvas px-4 py-3 sm:px-5",
        className,
      )}
      {...props}
    />
  );
}
