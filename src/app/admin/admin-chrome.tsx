"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminShell, type AdminShellLinkProps } from "@merqo/ui";
import { Badge } from "@merqo/ui/primitives";

import { Wordmark } from "@/components/landing/wordmark";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/vendors", label: "Vendors" },
  { href: "/admin/activity", label: "Activity" },
];

// A function prop cannot cross from the server layout, so the Next link
// adapter lives here beside the usePathname call the shell needs.
function NextLink(props: AdminShellLinkProps) {
  return <Link {...props} />;
}

/** Admin header and section tabs; `actions` carries the server-bound sign-out form. */
export function AdminChrome({
  actions,
  children,
}: {
  actions: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <AdminShell
      wordmark={<Wordmark className="text-xl" />}
      badge={<Badge variant="secondary">Admin</Badge>}
      tabs={TABS}
      pathname={pathname}
      actions={actions}
      LinkComponent={NextLink}
    >
      {children}
    </AdminShell>
  );
}
