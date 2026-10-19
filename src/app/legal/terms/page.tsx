import type { Metadata } from "next";
import { LegalDocument } from "@merqo/ui";

export const metadata: Metadata = {
  title: "Terms of Service",
};

export default function TermsPage() {
  return <LegalDocument doc="terms" kit="paykit" />;
}
