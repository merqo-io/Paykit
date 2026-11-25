import { z } from "zod";

export const PAGE_SIZE = 25;

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Bad input never throws: a malformed query string falls back to the
// unfiltered first page instead of an error screen.
const pageField = z.coerce.number().int().min(1).max(100_000).catch(1);
const dayField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)))
  .optional()
  .catch(undefined);

const vendorsSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  page: pageField,
});

const activitySchema = z.object({
  action: z.string().trim().max(60).optional().catch(undefined),
  from: dayField,
  to: dayField,
  page: pageField,
});

export type VendorListParams = { q: string; page: number };
export type ActivityListParams = {
  action: string;
  from: string;
  to: string;
  page: number;
};

export function parseVendorParams(raw: RawParams): VendorListParams {
  const parsed = vendorsSchema.parse({
    q: first(raw.q),
    page: first(raw.page),
  });
  return { q: parsed.q ?? "", page: parsed.page };
}

export function parseActivityParams(raw: RawParams): ActivityListParams {
  const parsed = activitySchema.parse({
    action: first(raw.action),
    from: first(raw.from),
    to: first(raw.to),
    page: first(raw.page),
  });
  return {
    action: parsed.action ?? "",
    from: parsed.from ?? "",
    to: parsed.to ?? "",
    page: parsed.page,
  };
}

export type Paged<T> = {
  rows: T[];
  page: number;
  pageCount: number;
  total: number;
  /** True when the requested page is past the end and the caller should redirect to `pageCount`. */
  overflow: boolean;
};

export function paginate<T>(
  items: T[],
  page: number,
  size = PAGE_SIZE,
): Paged<T> {
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const overflow = page > pageCount;
  const current = Math.min(page, pageCount);
  return {
    rows: items.slice((current - 1) * size, current * size),
    page: current,
    pageCount,
    total,
    overflow,
  };
}

/** Builds a list URL, dropping empty values and the default first page. */
export function listHref(
  path: string,
  params: Record<string, string | number>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const text = String(value);
    if (text === "" || (key === "page" && text === "1")) continue;
    search.set(key, text);
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Singapore calendar days, the zone admins read dates in. */
export function dayBounds(from: string, to: string) {
  return {
    fromMs: from ? Date.parse(`${from}T00:00:00+08:00`) : -Infinity,
    toMs: to ? Date.parse(`${to}T23:59:59.999+08:00`) : Infinity,
  };
}
