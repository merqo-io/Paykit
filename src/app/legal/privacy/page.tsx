import type { Metadata } from "next";
import { legalPageMetadata } from "@merqo/ui";
import { PaykitLegalPage } from "../legal-page-client";

export const metadata: Metadata = legalPageMetadata("privacy");

export default function PrivacyPage() {
  return <PaykitLegalPage doc="privacy" />;
}
