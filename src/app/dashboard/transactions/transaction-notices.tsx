import Link from "next/link";
import { FREE_LIST_DAYS } from "@/lib/free-limits";

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
