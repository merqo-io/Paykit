import type { Metadata } from "next";
import Link from "next/link";
import { getVendorSession } from "@/lib/vendor-session";
import { readVendorPlan } from "@/lib/vendor-entitlement";
import {
  freeListCutoff,
  isPaidPlan,
  resolveListRange,
} from "@/lib/free-limits";
import { countTransactionsBefore, queryTransactions } from "@/lib/transactions";
import { EmptyState, PageHeader } from "@merqo/ui";
import { TransactionTable } from "./transaction-table";
import { TransactionFilters } from "./transaction-filters";
import { TransactionsPager } from "./transactions-pager";
import {
  parseTransactionsParams,
  TRANSACTIONS_PAGE_SIZE,
  transactionsHref,
} from "./search-params";

export const metadata: Metadata = {
  title: "Payments",
};

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, user } = await getVendorSession();
  const params = parseTransactionsParams(await searchParams);

  const isPaid = isPaidPlan(await readVendorPlan(supabase, user.id));
  // The window comes from the plan, never from the URL alone, so a crafted
  // `from` can't reach rows past the Free cutoff; search is paid-only.
  const range = resolveListRange(isPaid, params);
  const cutoff = isPaid ? undefined : freeListCutoff();
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
  const filtered = Boolean(
    params.status || params.from || params.to || (isPaid && params.q),
  );

  return (
    <div>
      <PageHeader
        responsive
        title="Payments"
        description={
          isPaid
            ? "Every payment across your kits."
            : "Your payments from the last 30 days."
        }
      />
      <TransactionFilters params={params} isPaid={isPaid} />
      {result.failed ? (
        <EmptyState
          title="Couldn't load payments"
          description="Something went wrong reading your payments."
          actions={
            <Link href={transactionsHref(params)} className="text-sm underline">
              Try again
            </Link>
          }
        />
      ) : (
        <>
          <TransactionTable
            transactions={result.rows}
            isPro={isPaid}
            filtered={filtered}
          />
          <TransactionsPager params={params} pageCount={pageCount} />
        </>
      )}
      {hiddenCount > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          {hiddenCount} older payment{hiddenCount === 1 ? "" : "s"} hidden on
          Free. They are kept; Starter and Pro show your full history.{" "}
          <Link href="/dashboard/plan" className="underline">
            See plans
          </Link>
        </p>
      )}
    </div>
  );
}
