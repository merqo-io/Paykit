import type { Metadata } from "next";
import Link from "next/link";
import { NotFound } from "@merqo/ui";

import { Wordmark } from "@/components/landing/wordmark";

export const metadata: Metadata = {
  title: "Payment link not valid",
  robots: { index: false, follow: false },
};

// Every way of lacking the right token lands here on purpose, so the copy
// cannot say which one it was (expired, mistyped or never existed).
export default function PayNotFound() {
  return (
    <NotFound
      wordmark={<Wordmark className="text-xl" />}
      description="This payment link is not valid. It may be incomplete, expired or replaced. Ask the stall to show a new QR. If you have already paid, do not pay again."
      LinkComponent={Link}
    />
  );
}
