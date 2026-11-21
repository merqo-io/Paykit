"use client";

import Link from "next/link";
import { LegalPage } from "@merqo/ui";
import { Wordmark } from "@/components/landing/wordmark";

// LegalPage is server-safe, but the LegalDocument inside it ships a
// "Back" button with an onClick, and the published bundle drops that
// module's "use client" boundary when LegalPage imports it. Rendering from
// a client module keeps the handler legal until the package fixes that.
export function PaykitLegalPage({
  doc,
  kit,
}: {
  doc: "terms" | "privacy";
  kit?: string;
}) {
  return (
    <LegalPage
      doc={doc}
      kit={kit}
      wordmark={<Wordmark className="text-xl" />}
      LinkComponent={Link}
    />
  );
}
