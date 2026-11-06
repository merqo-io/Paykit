"use client";

import { DataTable, type DataTableColumn } from "@merqo/ui";
import { type VendorRow } from "@/lib/admin-data";
import { Badge } from "@/components/ui/badge";
import { VendorStatusBadge } from "@/app/admin/vendors/vendor-status";

// `columns` holds `cell` render callbacks and `getRowKey` is a function, so
// `DataTable` (a `@merqo/ui` Client Component) can only be rendered from
// another Client Component — a function prop can't cross the Server → Client
// boundary directly from `page.tsx`. Same reasoning as `activity-section.tsx`.
const columns: DataTableColumn<VendorRow>[] = [
  {
    header: "Vendor",
    cell: (v) => (
      <>
        <p className="font-medium">{v.email ?? "Not set"}</p>
        {(v.payee_name || v.label) && (
          <p className="text-xs text-muted-foreground">
            {v.payee_name ?? v.label}
          </p>
        )}
      </>
    ),
  },
  {
    header: "Status",
    cell: (v) => <VendorStatusBadge status={v.status} />,
  },
  {
    header: "Plan",
    cell: (v) =>
      v.plan === "pro" ? (
        <Badge variant="default">Pro</Badge>
      ) : (
        <Badge variant="outline">Free</Badge>
      ),
  },
  {
    header: "Transactions",
    cell: (v) => v.transaction_count,
    className: "text-right tabular-nums",
  },
  {
    header: "Joined",
    cell: (v) => new Date(v.created_at).toLocaleDateString("en-SG"),
  },
];

export function VendorsTable({ rows }: { rows: VendorRow[] }) {
  return (
    <DataTable rows={rows} columns={columns} getRowKey={(v) => v.vendor_id} />
  );
}
