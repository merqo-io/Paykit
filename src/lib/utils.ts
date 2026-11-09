/** Adapter for the shared useAsyncAction: runs a server-action thunk and lets its promise settle. */
export const callHandler = (fn: () => Promise<void>) => fn();

/** Milliseconds in one hour. Shared by rolling-window stats cutoffs. */
export const MS_PER_HOUR = 3_600_000;

/** Milliseconds in one day. Shared by rolling-window stats cutoffs. */
export const MS_PER_DAY = 86_400_000;

export const FORM_LABEL_CLASS =
  "text-xs font-semibold uppercase tracking-wider text-muted-foreground";

/** Shared inline field-error style across the vendor form pages. */
export const FORM_ERROR_CLASS = "text-sm font-medium text-destructive";

/** Formats an integer cents amount as an SGD currency string ("$4.50"). */
export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
  }).format(cents / 100);
}

/**
 * Formats a Postgres `date` column ("YYYY-MM-DD", no time-of-day) for
 * display. Parsed as UTC midnight and formatted with `timeZone: "UTC"` so
 * the date shown never shifts by a day depending on the server's runtime
 * timezone — a plain `new Date(isoDate).toLocaleDateString()` would.
 */
export function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-SG", {
    timeZone: "UTC",
  });
}

/** Period-over-period percent change; null when there's no prior period to compare against. */
export function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return ((current - prior) / prior) * 100;
}
