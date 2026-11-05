import type { ReactNode } from "react";
import { cn, FORM_LABEL_CLASS } from "@/lib/utils";

/**
 * Page title block shared by dashboard pages: eyebrow, h1, optional muted
 * line, and an actions slot that sits beside the title from `sm` up.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <p className={cn(FORM_LABEL_CLASS, "tracking-[0.16em]")}>{eyebrow}</p>
        <h1 className="font-display mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
