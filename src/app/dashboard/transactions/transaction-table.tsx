"use client";

import { EmptyState } from "@merqo/ui";
import { DataTable, type DataTableColumn } from "@merqo/ui";
import { formatCents } from "@/lib/utils";
import { RefundDialog } from "./refund-dialog";
import { TransactionStatusBadge } from "./transaction-status-badge";
import type { Transaction } from "@/lib/types";

// `columns` holds `cell` render callbacks and `getRowKey` is a function, so
// this has to be a Client Component — a function prop can't cross the
// Server → Client boundary into `@merqo/ui`'s `DataTable` directly from a
// page. Same shape as `admin/vendors/vendors-table.tsx`.
const BASE_COLUMNS: DataTableColumn<Transaction>[] = [
  { header: "Kit", cell: (tx) => tx.kit_slug },
  { header: "Reference", cell: (tx) => tx.order_ref },
  { header: "Amount", cell: (tx) => formatCents(tx.amount_cents) },
  {
    header: "Status",
    cell: (tx) => <TransactionStatusBadge status={tx.status} />,
  },
  {
    header: "Created",
    cell: (tx) => new Date(tx.created_at).toLocaleDateString("en-SG"),
  },
];

// Refunds are Pro-only, so the column exists or it doesn't — an empty cell
// would still widen the table for a Free vendor.
const REFUND_COLUMN: DataTableColumn<Transaction> = {
  header: "Refund",
  cell: (tx) =>
    tx.status === "confirmed" ? <RefundDialog transactionId={tx.id} /> : null,
};

export function TransactionTable({
  transactions,
  isPro,
}: {
  transactions: Transaction[];
  isPro: boolean;
}) {
  if (transactions.length === 0) {
    return (
      <EmptyState
        title="No payments yet"
        description="Payments from your kits appear here as customers check out."
      />
    );
  }
  return (
    <div className="min-w-0 overflow-x-auto">
      <DataTable
        rows={transactions}
        columns={isPro ? [...BASE_COLUMNS, REFUND_COLUMN] : BASE_COLUMNS}
        getRowKey={(tx) => tx.id}
      />
    </div>
  );
}
