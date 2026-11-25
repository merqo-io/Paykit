import { z } from "zod";

export const BOOKING_PAGE_SIZE = 20;

export const BOOKING_STATUS_FILTERS = [
  "pending_deposit",
  "deposit_paid",
  "fully_paid",
  "cancelled",
] as const;

export type BookingStatusFilter = (typeof BOOKING_STATUS_FILTERS)[number];

export type BookingListParams = {
  q: string;
  status: BookingStatusFilter | null;
  page: number;
};

const firstValue = (v: unknown) => (Array.isArray(v) ? v[0] : v);

// Bad or hostile query strings fall back to the unfiltered first page rather
// than erroring: the URL is user-editable and a stale bookmark should still load.
const schema = z.object({
  q: z.preprocess(
    firstValue,
    z
      .string()
      .transform((s) => s.trim().slice(0, 80))
      .catch(""),
  ),
  status: z.preprocess(
    firstValue,
    z.enum(BOOKING_STATUS_FILTERS).nullable().catch(null),
  ),
  page: z.preprocess(
    firstValue,
    z.coerce.number().int().min(1).max(10_000).catch(1),
  ),
});

export function parseBookingListParams(
  raw: Record<string, string | string[] | undefined>,
): BookingListParams {
  const parsed = schema.parse({
    q: raw.q ?? "",
    status: raw.status ?? null,
    page: raw.page ?? 1,
  });
  return { q: parsed.q, status: parsed.status, page: parsed.page };
}

export function hasActiveFilters(params: BookingListParams): boolean {
  return params.q !== "" || params.status !== null;
}

/** Builds the list URL, dropping defaults so links stay short and canonical. */
export function bookingListHref(params: Partial<BookingListParams>): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  if (params.page && params.page > 1) search.set("page", String(params.page));
  const qs = search.toString();
  return qs ? `/dashboard/bookings?${qs}` : "/dashboard/bookings";
}
