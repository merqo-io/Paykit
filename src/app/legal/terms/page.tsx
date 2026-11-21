import type { Metadata } from "next";
import { legalPageMetadata } from "@merqo/ui";
import { PaykitLegalPage } from "../legal-page-client";

export const metadata: Metadata = legalPageMetadata("terms");

export default function TermsPage() {
  return <PaykitLegalPage doc="terms" kit="paykit" />;
}
