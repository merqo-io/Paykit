import { z } from "zod";

export const REPORT_TABS = ["overview", "earnings"] as const;
export type ReportTab = (typeof REPORT_TABS)[number];

const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);

/**
 * Reports search params are user-controlled, so each one falls back to a safe
 * default instead of failing the page: a bad `tab` shows Overview and a bad
 * `year` shows the current year.
 */
export function parseReportsParams(
  raw: Record<string, string | string[] | undefined>,
  now: Date = new Date(),
): { tab: ReportTab; year: number } {
  const schema = z.object({
    tab: z.enum(REPORT_TABS).catch("overview"),
    year: z.coerce
      .number()
      .int()
      .min(2001)
      .max(2999)
      .catch(now.getUTCFullYear()),
  });
  return schema.parse({ tab: first(raw.tab), year: first(raw.year) });
}

export function reportsHref(tab: ReportTab, year?: number): string {
  const params = new URLSearchParams();
  if (tab !== "overview") params.set("tab", tab);
  if (year !== undefined) params.set("year", String(year));
  const qs = params.toString();
  return qs ? `/dashboard/reports?${qs}` : "/dashboard/reports";
}
