import type { Metadata } from "next";
import { legalPageMetadata } from "@merqo/ui";
import { LegalPageClient } from "../legal-page-client";

export const metadata: Metadata = legalPageMetadata("privacy");

export default function PrivacyPage() {
  return <LegalPageClient doc="privacy" />;
}
