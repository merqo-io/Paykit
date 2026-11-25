/** Adapter for the shared useAsyncAction: runs a server-action thunk and lets its promise settle. */
export const callHandler = (fn: () => Promise<void>) => fn();

/** Milliseconds in one hour. Shared by rolling-window stats cutoffs. */
export const MS_PER_HOUR = 3_600_000;

/** Milliseconds in one day. Shared by rolling-window stats cutoffs. */
export const MS_PER_DAY = 86_400_000;

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

/**
 * Formats a timestamp as a date in Singapore time. SSR runs in UTC while the
 * browser runs in the user zone, so an unpinned format renders a different
 * day on each side for rows created 00:00-08:00 SGT and breaks hydration.
 */
export function formatSgtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-SG", {
    timeZone: "Asia/Singapore",
  });
}

/** Date and time in Singapore time; pinned for the same hydration reason as formatSgtDate. */
export function formatSgtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
  });
}
