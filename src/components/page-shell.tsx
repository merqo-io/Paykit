import type { ReactNode } from "react";
import { PageHeader } from "@merqo/ui";
import { cn } from "@merqo/ui/primitives";
import { ABOVE_TAB_BAR_OFFSET } from "@/components/nav/tab-bar-height";

const WIDTHS = {
  list: "max-w-5xl",
  form: "max-w-2xl",
} as const;

export type PageShellWidth = keyof typeof WIDTHS;

/**
 * The one page frame for dashboard pages: shared `PageHeader` (title,
 * description) inside a consistent container width. The action is one
 * element: beside the title from `lg`, and below `lg` anchored above the tab
 * bar so it stays in the thumb zone.
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
        action ? "pb-20 lg:pb-0" : undefined,
      )}
    >
      <PageHeader
        title={title}
        description={description}
        action={
          action ? (
            <div
              data-testid="page-shell-action"
              style={{ bottom: ABOVE_TAB_BAR_OFFSET }}
              className="fixed inset-x-0 z-30 border-t bg-background p-3 lg:static lg:inset-auto lg:z-auto lg:border-0 lg:bg-transparent lg:p-0 print:static print:border-0 print:p-0 [&>*]:w-full lg:[&>*]:w-auto print:[&>*]:w-auto"
            >
              {action}
            </div>
          ) : null
        }
        className={tabs ? "mb-4" : undefined}
      />
      {tabs ? <div className="mb-6">{tabs}</div> : null}
      {children}
    </div>
  );
}
