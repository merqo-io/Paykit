import type { Metadata } from "next";
import type { ReactNode } from "react";

// Rendered per request so the nonce CSP from proxy.ts reaches its scripts.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
};

/** Gives the client-rendered login page its own tab title. */
export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
