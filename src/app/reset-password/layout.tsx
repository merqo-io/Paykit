import type { Metadata } from "next";
import type { ReactNode } from "react";

// Rendered per request so the nonce CSP from proxy.ts reaches its scripts.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reset password",
};

/** Gives the client-rendered reset-password page its own tab title. */
export default function ResetPasswordLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
