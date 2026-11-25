import Link from "next/link";
import { FREE_LIST_DAYS } from "@/lib/free-limits";

/**
 * A failed read must not look like an empty ledger, so it gets its own alert
 * rather than the shared empty state.
 */
export function LoadError({ retryHref }: { retryHref: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-destructive/40 p-6 text-center"
    >
      <h2 className="text-base font-semibold text-destructive">
        Couldn&apos;t load payments
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Something went wrong reading your payments.
      </p>
      <Link href={retryHref} className="mt-3 inline-block text-sm underline">
        Try again
      </Link>
    </div>
  );
}

/** Counts the older payments Free hides; renders nothing when there are none. */
export function HiddenNote({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <p className="mt-4 text-sm text-muted-foreground">
      {count} older payment{count === 1 ? "" : "s"} hidden on Free. They are
      kept; Starter and Pro show your full history.{" "}
      <Link href="/dashboard/plan" className="underline">
        See plans
      </Link>
    </p>
  );
}

/** Shown when a Free vendor's requested range reaches past the 30-day cutoff. */
export function FreeRangeNote() {
  return (
    <p className="mb-4 text-sm text-muted-foreground">
      Free shows the last {FREE_LIST_DAYS} days.{" "}
      <Link href="/dashboard/plan" className="underline">
        See plans
      </Link>
    </p>
  );
}
