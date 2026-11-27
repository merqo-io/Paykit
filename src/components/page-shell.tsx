import type { ReactNode } from "react";
import { PageHeader } from "@merqo/ui";
import { cn } from "@merqo/ui/primitives";

const WIDTHS = {
  list: "max-w-5xl",
  form: "max-w-2xl",
} as const;

export type PageShellWidth = keyof typeof WIDTHS;

/**
 * The one page frame for dashboard pages: shared `PageHeader` (title,
 * description) inside a consistent container width. The action sits beside
 * the title from `sm`; on a phone it is anchored above the tab bar so it
 * stays in the thumb zone.
 */
export function PageShell({
  title,
  description,
  action,
  tabs,
  width = "list",
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Sub-navigation rendered under the header. */
  tabs?: ReactNode;
  width?: PageShellWidth;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full",
        WIDTHS[width],
        action ? "pb-20 sm:pb-0" : undefined,
      )}
    >
      <PageHeader
        title={title}
        description={description}
        action={action ? <div className="hidden sm:block">{action}</div> : null}
        className={tabs ? "mb-4" : undefined}
      />
      {tabs ? <div className="mb-6">{tabs}</div> : null}
      {children}
      {action ? (
        <div
          data-testid="page-shell-mobile-action"
          className="fixed inset-x-0 bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-30 border-t bg-background p-3 sm:hidden print:hidden [&>*]:w-full"
        >
          {action}
        </div>
      ) : null}
    </div>
  );
}
