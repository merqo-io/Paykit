"use client";

import Link from "next/link";
import { DataTable, type DataTableColumn } from "@merqo/ui";
import { formatDate } from "@/lib/utils";
import { InquiryStatusBadge } from "./inquiry-badges";
import type { Inquiry } from "@/lib/types";

const columns: DataTableColumn<Inquiry>[] = [
  {
    header: "Client",
    cell: (inquiry) => (
      <Link
        href={`/dashboard/bookings/inquiries/${inquiry.id}`}
        className="font-medium underline-offset-4 hover:underline"
      >
        {inquiry.customer_name}
      </Link>
    ),
  },
  {
    header: "Event date",
    cell: (inquiry) =>
      inquiry.event_date ? formatDate(inquiry.event_date) : "Not given",
  },
  {
    header: "Received",
    cell: (inquiry) =>
      new Date(inquiry.created_at).toLocaleDateString("en-SG", {
        timeZone: "Asia/Singapore",
      }),
  },
  {
    header: "Status",
    cell: (inquiry) => <InquiryStatusBadge status={inquiry.status} />,
  },
];

export function InquiryTable({ inquiries }: { inquiries: Inquiry[] }) {
  return (
    <DataTable
      rows={inquiries}
      columns={columns}
      getRowKey={(inquiry) => inquiry.id}
      emptyState="No open inquiries."
    />
  );
}
