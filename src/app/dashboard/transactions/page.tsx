import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getVendorSession } from "@/lib/vendor-session";
import { pathWithSearch } from "@/lib/return-to";
import { readVendorPlan } from "@/lib/vendor-entitlement";
import { sgDayKey } from "@merqo/ui";
import {
  freeListCutoff,
  isPaidPlan,
  resolveListRange,
  sgtDayStartIso,
} from "@/lib/free-limits";
import { countTransactionsBefore, queryTransactions } from "@/lib/transactions";
import { PageShell } from "@/components/page-shell";
import { TransactionTable } from "./transaction-table";
import { TransactionFilters } from "./transaction-filters";
import { ListError } from "@/components/list/list-error";
import { UrlPager } from "@/components/list/url-pager";
import { FreeRangeNote, HiddenNote } from "./transaction-notices";
import {
  parseTransactionsParams,
  TRANSACTIONS_PAGE_SIZE,
  transactionsHref,
} from "./search-params";

export const metadata: Metadata = {
  title: "Payments",
};

/** Free's list stops at the cutoff; true when the requested `from` reaches past it. */
function cutRangeShort(cutoff: string | undefined, from: string | undefined) {
  return Boolean(cutoff && from && sgtDayStartIso(from) < cutoff);
}

// An unreadable cutoff gives no date bound rather than an empty `min`.
function minDateOf(cutoff: string | null | undefined): string | undefined {
  return (cutoff && sgDayKey(cutoff)) || undefined;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const { supabase, user } = await getVendorSession(
    pathWithSearch("/dashboard/transactions", rawParams),
  );
  const params = parseTransactionsParams(rawParams);

  const isPaid = isPaidPlan(await readVendorPlan(supabase, user.id));
  // The window comes from the plan, never from the URL alone, so a crafted
  // `from` can't reach rows past the Free cutoff; search is paid-only.
  const now = new Date();
  const range = resolveListRange(isPaid, params, now);
  const cutoff = isPaid ? undefined : freeListCutoff(now);
  // A stale `q` from a pre-downgrade bookmark must not be carried into links.
  const linkParams = isPaid ? params : { ...params, q: undefined };
  const [result, hiddenCount] = await Promise.all([
    queryTransactions(user.id, {
      ...range,
      status: params.status,
      search: isPaid ? params.q : undefined,
      page: params.page,
      pageSize: TRANSACTIONS_PAGE_SIZE,
    }),
    cutoff ? countTransactionsBefore(user.id, cutoff) : 0,
  ]);

  const pageCount = Math.max(
    1,
    Math.ceil(result.total / TRANSACTIONS_PAGE_SIZE),
  );
  if (!result.failed && params.page > pageCount) {
    redirect(transactionsHref({ ...linkParams, page: pageCount }));
  }
  const filtered = Boolean(
    params.status || params.from || params.to || (isPaid && params.q),
  );

  return (
    <PageShell
      title="Payments"
      description={
        isPaid
          ? "Every payment across your kits."
          : "Your payments from the last 30 days."
      }
    >
      <TransactionFilters
        params={params}
        isPaid={isPaid}
        minDate={minDateOf(cutoff)}
      />
      {cutRangeShort(cutoff, params.from) && <FreeRangeNote />}
      {result.failed ? (
        <ListError
          retryHref={transactionsHref(linkParams)}
          message="Couldn't load payments"
        />
      ) : (
        <>
          <TransactionTable
            transactions={result.rows}
            isPro={isPaid}
            filtered={filtered}
          />
          <UrlPager
            page={linkParams.page}
            pageCount={pageCount}
            href={(next) => transactionsHref({ ...linkParams, page: next })}
          />
        </>
      )}
      <HiddenNote count={hiddenCount} />
    </PageShell>
  );
}
