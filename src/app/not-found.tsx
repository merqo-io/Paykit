import type { Metadata } from "next";
import Link from "next/link";
import { NotFound } from "@merqo/ui";

import { Wordmark } from "@/components/landing/wordmark";

export const metadata: Metadata = {
  title: "Page not found",
};

/** Branded fallback for a missing page or an out-of-date checkout link. */
export default function NotFoundPage() {
  return (
    <NotFound
      wordmark={<Wordmark className="text-xl" />}
      description="This link may be out of date, or the page it pointed to no longer exists. Go back home to start again."
      LinkComponent={Link}
    />
  );
}
