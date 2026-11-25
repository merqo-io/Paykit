import Link from "next/link";
import { Button } from "@merqo/ui/primitives";

/** Shown when a data read fails; a failed read must never look like "no results". */
export function ListError({
  retryHref,
  message = "Couldn't load this list.",
}: {
  retryHref: string;
  message?: string;
}) {
  return (
    <div role="alert" className="space-y-3 border-l-2 border-destructive pl-4">
      <p className="text-sm">{message}</p>
      <Button asChild variant="outline" size="sm">
        <Link href={retryHref}>Try again</Link>
      </Button>
    </div>
  );
}
