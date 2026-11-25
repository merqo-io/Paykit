import type { Metadata } from "next";
import Link from "next/link";
import { NotFound } from "@merqo/ui";

import { Wordmark } from "@/components/landing/wordmark";

export const metadata: Metadata = {
  title: "Inquiry form not available",
  robots: { index: false, follow: false },
};

// Unknown and turned-off forms look the same on purpose.
export default function InquireNotFound() {
  return (
    <NotFound
      wordmark={<Wordmark className="text-xl" />}
      description="This inquiry form is not available. The link may be mistyped, or the business has turned its form off. Check the link you were given, or contact the business directly."
      LinkComponent={Link}
    />
  );
}
