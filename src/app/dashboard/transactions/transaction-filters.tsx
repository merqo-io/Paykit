import Link from "next/link";
import { Button, Input, Label } from "@merqo/ui/primitives";
import { FORM_LABEL_CLASS } from "@merqo/ui";
import type { TransactionsParams } from "./search-params";
import { transactionsHref } from "./search-params";

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * A plain GET form: filters live in the URL, so it works before hydration and
 * a filtered view can be bookmarked. Free vendors keep status and date but
 * search is locked, because search is the paid half of the ledger.
 */
export function TransactionFilters({
  params,
  isPaid,
}: {
  params: TransactionsParams;
  isPaid: boolean;
}) {
  const active = Boolean(params.q || params.status || params.from || params.to);
  return (
    <form
      method="get"
      action="/dashboard/transactions"
      className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end"
    >
      <div className="space-y-1.5">
        <Label htmlFor="tx-q" className={FORM_LABEL_CLASS}>
          Search
        </Label>
        <Input
          id="tx-q"
          name="q"
          type="search"
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
          className={SELECT_CLASS}
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
          defaultValue={params.from}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tx-to" className={FORM_LABEL_CLASS}>
          To
        </Label>
        <Input id="tx-to" name="to" type="date" defaultValue={params.to} />
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
