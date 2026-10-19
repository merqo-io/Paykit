import type { Metadata } from "next";
import { LegalDocument } from "@merqo/ui";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default function PrivacyPage() {
  return <LegalDocument doc="privacy" />;
}
