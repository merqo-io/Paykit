"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { AppLinkProvider } from "@merqo/ui";

// A Client Component because `next/link` is a plain function in a Server
// Component and cannot be serialised into props. Mounted once in the root
// layout so every client export of `@merqo/ui` navigates client-side without a
// `LinkComponent` prop.
export function AppLinks({ children }: { children: ReactNode }) {
  return <AppLinkProvider component={Link}>{children}</AppLinkProvider>;
}
