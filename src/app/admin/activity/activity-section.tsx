"use client";
import { formatSgtDateTime } from "@/lib/utils";

import Link from "next/link";
import { DataTable, type DataTableColumn } from "@merqo/ui";
import { formatAction } from "../action-labels";
import { listHref } from "../list-params";

export type ActivityEntry = {
  id: string;
  actor: string;
  action: string;
  target: string | null;
  detail: string | null;
  createdAt: string;
};

// The shared AuditLogTable renders `target` as plain text, so the vendor
// link needs its own columns. `columns` holds render callbacks, which is why
// this is a Client Component like `vendors-table.tsx`.
const columns: DataTableColumn<ActivityEntry>[] = [
  {
    header: "When",
    cell: (e) => formatSgtDateTime(e.createdAt),
    className: "whitespace-nowrap tabular-nums",
  },
  { header: "Actor", cell: (e) => e.actor },
  {
    header: "Action",
    cell: (e) => (
      <>
        <p>{formatAction(e.action)}</p>
        {e.detail && (
          <p className="text-xs text-muted-foreground">{e.detail}</p>
        )}
      </>
    ),
  },
  {
    header: "Target",
    cell: (e) =>
      e.target ? (
        <Link
          href={listHref("/admin/vendors", { q: e.target })}
          className="underline-offset-4 hover:underline"
        >
          {e.target}
        </Link>
      ) : null,
  },
];

export function ActivitySection({ entries }: { entries: ActivityEntry[] }) {
  return <DataTable rows={entries} columns={columns} getRowKey={(e) => e.id} />;
}
