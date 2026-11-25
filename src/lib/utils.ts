/** Adapter for the shared useAsyncAction: runs a server-action thunk and lets its promise settle. */
export const callHandler = (fn: () => Promise<void>) => fn();

/** Milliseconds in one hour. Shared by rolling-window stats cutoffs. */
export const MS_PER_HOUR = 3_600_000;

/** Milliseconds in one day. Shared by rolling-window stats cutoffs. */
export const MS_PER_DAY = 86_400_000;

/** Period-over-period percent change; null when there's no prior period to compare against. */
export function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return ((current - prior) / prior) * 100;
}
