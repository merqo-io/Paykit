"use client";

import Link from "next/link";
import { DataTable, Timestamp, type DataTableColumn } from "@merqo/ui";
import { PhoneList, PhoneRow } from "@/components/list/phone-row";
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
      inquiry.event_date ? (
        <Timestamp value={inquiry.event_date} variant="date" />
      ) : (
        "Not given"
      ),
  },
  {
    header: "Received",
    cell: (inquiry) => <Timestamp value={inquiry.created_at} variant="date" />,
  },
  {
    header: "Status",
    cell: (inquiry) => <InquiryStatusBadge status={inquiry.status} />,
  },
];

export function InquiryTable({ inquiries }: { inquiries: Inquiry[] }) {
  if (inquiries.length === 0) {
    return <p className="text-sm text-muted-foreground">No open inquiries.</p>;
  }
  return (
    <>
      <PhoneList label="Inquiries">
        {inquiries.map((inquiry) => (
          <PhoneRow
            key={inquiry.id}
            title={inquiry.customer_name}
            badge={<InquiryStatusBadge status={inquiry.status} />}
            secondary={
              <>
                <span>
                  {inquiry.event_date ? (
                    <Timestamp value={inquiry.event_date} variant="date" />
                  ) : (
                    "No date given"
                  )}
                </span>
                <span className="flex gap-1">
                  Received
                  <Timestamp value={inquiry.created_at} variant="date" />
                </span>
              </>
            }
          >
            <Link
              href={`/dashboard/bookings/inquiries/${inquiry.id}`}
              className="inline-flex min-h-11 items-center font-medium underline underline-offset-4"
            >
              View inquiry
            </Link>
          </PhoneRow>
        ))}
      </PhoneList>
      <div className="hidden min-w-0 overflow-x-auto sm:block">
        <DataTable
          rows={inquiries}
          columns={columns}
          getRowKey={(inquiry) => inquiry.id}
        />
      </div>
    </>
  );
}
