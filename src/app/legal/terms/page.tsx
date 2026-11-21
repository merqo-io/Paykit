import type { Metadata } from "next";
import { legalPageMetadata } from "@merqo/ui";
import { LegalPageClient } from "../legal-page-client";

export const metadata: Metadata = legalPageMetadata("terms");

export default function TermsPage() {
  return <LegalPageClient doc="terms" kit="paykit" />;
}
