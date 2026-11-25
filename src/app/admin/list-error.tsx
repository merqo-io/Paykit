import Link from "next/link";
import { Button } from "@merqo/ui/primitives";

/** Shown when the data read fails; a failed read must never look like "no results". */
export function ListError({ retryHref }: { retryHref: string }) {
  return (
    <div role="alert" className="space-y-3 border-l-2 border-destructive pl-4">
      <p className="text-sm">Could not load this list.</p>
      <Button asChild variant="outline" size="sm">
        <Link href={retryHref}>Try again</Link>
      </Button>
    </div>
  );
}
