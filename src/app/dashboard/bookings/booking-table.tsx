"use client";

import Link from "next/link";
import { EmptyState } from "@merqo/ui";
import { DataTable, type DataTableColumn } from "@merqo/ui";
import { formatCents, formatDate } from "@/lib/utils";
import { BookingStatusBadge, BalanceDueIndicator } from "./booking-badges";
import type { Booking } from "@/lib/types";

// `columns` holds `cell` render callbacks and `getRowKey` is a function, so
// this has to be a Client Component — a function prop can't cross the
// Server → Client boundary into `@merqo/ui`'s `DataTable` directly from a
// page. Same shape as `admin/vendors/vendors-table.tsx`.
const columns: DataTableColumn<Booking>[] = [
  {
    header: "Customer",
    cell: (booking) => (
      <Link
        href={`/dashboard/bookings/${booking.id}`}
        className="font-medium underline-offset-4 hover:underline"
      >
        {booking.customer_name}
      </Link>
    ),
  },
  { header: "Event date", cell: (booking) => formatDate(booking.event_date) },
  {
    header: "Total",
    cell: (booking) => formatCents(booking.total_amount_cents),
  },
  {
    header: "Status",
    cell: (booking) => <BookingStatusBadge status={booking.status} />,
  },
  {
    header: "Balance due",
    cell: (booking) => <BalanceDueIndicator booking={booking} />,
  },
];

export function BookingTable({
  bookings,
  filtered = false,
}: {
  bookings: Booking[];
  filtered?: boolean;
}) {
  if (bookings.length === 0 && filtered) {
    return (
      <div>
        <EmptyState
          title="No bookings match"
          description="Try a different name, phone number or status."
        />
        <p className="mt-3 text-sm">
          <Link
            href="/dashboard/bookings"
            className="underline underline-offset-4"
          >
            Clear filters
          </Link>
        </p>
      </div>
    );
  }
  if (bookings.length === 0) {
    return (
      <EmptyState
        title="No bookings yet"
        description="Bookings you add or accept from inquiries appear here."
      />
    );
  }
  return (
    <div className="min-w-0 overflow-x-auto">
      <DataTable
        rows={bookings}
        columns={columns}
        getRowKey={(booking) => booking.id}
      />
    </div>
  );
}
