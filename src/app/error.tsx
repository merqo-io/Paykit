"use client";

import Link from "next/link";
import { ErrorPage } from "@merqo/ui";
import { Button } from "@merqo/ui/primitives";

import { Wordmark } from "@/components/landing/wordmark";

/**
 * Root-level error boundary for non-dashboard routes. `/dashboard/*` has its
 * own `dashboard/error.tsx` because it renders inside the dashboard shell.
 */
export default function RootError({
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
      description="Could not load this page. Try again, or go back home."
      onError={(caught) => console.error("Root error boundary caught", caught)}
      actions={
        <Button asChild variant="outline" className="h-11 w-full rounded-lg">
          <Link href="/">Back to home</Link>
        </Button>
      }
    />
  );
}
