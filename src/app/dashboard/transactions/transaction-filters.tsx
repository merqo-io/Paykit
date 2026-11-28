import Link from "next/link";
import { Button, Input, Label } from "@merqo/ui/primitives";
import { FORM_LABEL_CLASS, SearchField } from "@merqo/ui";
import { FILTER_SELECT_CLASS } from "@/components/list/filter-classes";
import type { TransactionsParams } from "./search-params";
import { transactionsHref } from "./search-params";

/**
 * A plain GET form: filters live in the URL, so it works before hydration and
 * a filtered view can be bookmarked. Free vendors keep status and date but
 * search is locked, because search is the paid half of the ledger.
 */
export function TransactionFilters({
  params,
  isPaid,
  minDate,
}: {
  params: TransactionsParams;
  isPaid: boolean;
  /** Earliest selectable Singapore day for Free, whose list stops at the cutoff. */
  minDate?: string;
}) {
  const active = Boolean(params.q || params.status || params.from || params.to);
  return (
    <form
      method="get"
      action="/dashboard/transactions"
      className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end"
    >
      <div className="space-y-1.5">
        <Label id="tx-q-label" htmlFor="tx-q" className={FORM_LABEL_CLASS}>
          Search
        </Label>
        <SearchField
          id="tx-q"
          aria-labelledby="tx-q-label"
          name="q"
          maxLength={80}
          placeholder="Reference or title"
          defaultValue={isPaid ? params.q : undefined}
          disabled={!isPaid}
          aria-describedby={isPaid ? undefined : "tx-q-note"}
        />
        {!isPaid && (
          <p id="tx-q-note" className="text-xs text-muted-foreground">
            Search comes with Starter or Pro.{" "}
            <Link href="/dashboard/plan" className="underline">
              See plans
            </Link>
          </p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tx-status" className={FORM_LABEL_CLASS}>
          Status
        </Label>
        <select
          id="tx-status"
          name="status"
          defaultValue={params.status ?? ""}
          className={FILTER_SELECT_CLASS}
        >
          <option value="">All</option>
          <option value="claimed">Marked paid</option>
          <option value="pending">Awaiting payment</option>
          <option value="confirmed">Received</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tx-from" className={FORM_LABEL_CLASS}>
          From
        </Label>
        <Input
          id="tx-from"
          name="from"
          type="date"
          min={minDate}
          defaultValue={params.from}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tx-to" className={FORM_LABEL_CLASS}>
          To
        </Label>
        <Input
          id="tx-to"
          name="to"
          type="date"
          min={minDate}
          defaultValue={params.to}
        />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit">Apply</Button>
        {active && (
          <Link
            href={transactionsHref({})}
            className="text-sm text-muted-foreground underline"
          >
            Clear filters
          </Link>
        )}
      </div>
    </form>
  );
}
