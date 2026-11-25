"use client";

import { AuditLogTable, type AuditLogEntry } from "@merqo/ui";
import { formatAction } from "../action-labels";

// `formatAction` is a function prop, so `AuditLogTable` (a `@merqo/ui`
// Client Component) can only be rendered from another Client Component, not
// passed the function directly from `page.tsx`'s Server Component — same
// reasoning as `vendors-table.tsx`'s own `"use client"`.
export function ActivitySection({ entries }: { entries: AuditLogEntry[] }) {
  return <AuditLogTable entries={entries} formatAction={formatAction} />;
}
