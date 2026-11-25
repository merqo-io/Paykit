import { z } from "zod";
import type { TxStatus } from "@/lib/types";

export const TRANSACTIONS_PAGE_SIZE = 25;

const first = (v: unknown): unknown => (Array.isArray(v) ? v[0] : v);

const isRealDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);

export type TransactionsParams = {
  q?: string;
  status?: TxStatus;
  from?: string;
  to?: string;
  page: number;
};

/**
 * Ledger search params are user-controlled, so each one falls back to "not
 * set" instead of failing the page. `?status=claimed` is the deep link the
 * dashboard uses for payments waiting on the vendor to confirm.
 */
export function parseTransactionsParams(
  raw: Record<string, string | string[] | undefined>,
): TransactionsParams {
  const schema = z.object({
    q: z.string().trim().min(1).max(80).optional().catch(undefined),
    status: z
      .enum(["pending", "claimed", "confirmed"])
      .optional()
      .catch(undefined),
    from: z.string().refine(isRealDate).optional().catch(undefined),
    to: z.string().refine(isRealDate).optional().catch(undefined),
    page: z.coerce.number().int().min(1).max(100_000).catch(1),
  });
  return schema.parse({
    q: first(raw.q),
    status: first(raw.status),
    from: first(raw.from),
    to: first(raw.to),
    page: first(raw.page),
  });
}

/** Query string for the ledger, omitting unset filters and page 1. */
export function transactionsHref(params: Partial<TransactionsParams>): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.status) qs.set("status", params.status);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.page && params.page > 1) qs.set("page", String(params.page));
  const s = qs.toString();
  return s ? `/dashboard/transactions?${s}` : "/dashboard/transactions";
}
