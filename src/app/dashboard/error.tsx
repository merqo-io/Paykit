"use client";

import Link from "next/link";
import { ErrorPage } from "@merqo/ui";
import { Button } from "@merqo/ui/primitives";

import { Wordmark } from "@/components/landing/wordmark";

/**
 * Error boundary for every /dashboard/* page. It catches render/data errors
 * below `layout.tsx`; the header/nav keeps rendering, since an error boundary
 * never catches errors from its own segment's layout.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorPage
      error={error}
      reset={reset}
      wordmark={<Wordmark className="text-xl" />}
      description="Could not load this page. Try again, or go back to your dashboard."
      onError={(caught) =>
        console.error("Dashboard error boundary caught", caught)
      }
      actions={
        <Button asChild variant="outline" className="h-11 w-full rounded-lg">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      }
    />
  );
}
