import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Dashed card for a list or section with nothing in it yet: a headline, one
 * muted sentence and up to two calls to action.
 */
export function EmptyState({
  title,
  description,
  primaryAction,
  secondaryAction,
  className,
}: {
  title: string;
  description: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-dashed bg-card/50 px-6 py-10 text-center",
        className,
      )}
    >
      <h2 className="font-display text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
      {primaryAction || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {primaryAction}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
