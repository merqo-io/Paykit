"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * One phone list row: a two-line summary that expands to reveal its detail and
 * action. The toggle button holds only the title; its `::after` stretches over
 * the whole row so the entire row is the tap target. The badge sits outside
 * the button (raised above the overlay) because status badges carry their own
 * info popover, and a button must not nest another button.
 */
export function PhoneRow({
  title,
  badge,
  secondary,
  children,
}: {
  /** Line one, left: the amount or name. */
  title: ReactNode;
  /** Line one, right: the status badge. */
  badge: ReactNode;
  /** Line two: the kit or slot, plus the date. */
  secondary: ReactNode;
  /** Revealed on tap: the reference and the row's action. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <li className="relative border-b last:border-b-0">
      <div className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-1 py-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="min-w-0 truncate text-left font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-[-2px] focus-visible:after:outline-ring"
        >
          {title}
        </button>
        <div className="relative z-10 justify-self-end">{badge}</div>
        <div className="col-span-2 flex items-center justify-between gap-3 text-sm text-muted-foreground">
          {secondary}
        </div>
      </div>
      <div id={panelId} hidden={!open} className="space-y-3 px-1 pb-3 text-sm">
        {open ? children : null}
      </div>
    </li>
  );
}

/**
 * Phone-only list. Hidden from `sm` by CSS so the table takes over without a
 * width hook; the table sibling is `hidden sm:block`.
 */
export function PhoneList({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <ul aria-label={label} className="border-t sm:hidden">
      {children}
    </ul>
  );
}
