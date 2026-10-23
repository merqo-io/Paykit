import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getVendorSession } from "@/lib/vendor-session";
import { getInquiry } from "@/lib/inquiry-inbox";
import { formatDate } from "@/lib/utils";
import { whatsappLink } from "@/lib/phone-links";
import { InquiryStatusBadge, TermsSnapshot } from "../../inquiry-badges";
import { NewBookingDialog } from "../../new-booking-dialog";
import { InquiryDetailActions } from "./inquiry-detail-actions";

export const metadata: Metadata = {
  title: "Inquiry",
};

export default async function InquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await getVendorSession();
  const inquiry = await getInquiry(user.id, id);
  if (!inquiry) notFound();

  const received = new Date(inquiry.created_at).toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {inquiry.customer_name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Received {received}
          </p>
        </div>
        <InquiryStatusBadge status={inquiry.status} />
      </div>

      <div className="rounded-xl border p-4 text-sm">
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt className="text-muted-foreground">Phone</dt>
          <dd className="flex flex-wrap gap-3">
            <a
              href={`tel:${inquiry.customer_phone.replace(/\s/g, "")}`}
              className="underline underline-offset-4"
            >
              {inquiry.customer_phone}
            </a>
            <a
              href={whatsappLink(inquiry.customer_phone)}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              WhatsApp
            </a>
          </dd>
          <dt className="text-muted-foreground">Event date</dt>
          <dd>
            {inquiry.event_date ? formatDate(inquiry.event_date) : "Not given"}
          </dd>
          <dt className="text-muted-foreground">Booking terms</dt>
          <dd>
            <TermsSnapshot inquiry={inquiry} />
          </dd>
        </dl>
        <p className="mt-4 whitespace-pre-wrap">{inquiry.message}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {inquiry.booking_id ? (
          <Link
            href={`/dashboard/bookings/${inquiry.booking_id}`}
            className="text-sm font-medium underline underline-offset-4"
          >
            Open the booking
          </Link>
        ) : (
          inquiry.status !== "converted" && (
            <NewBookingDialog
              triggerLabel="Convert to booking"
              prefill={{
                inquiryId: inquiry.id,
                customerName: inquiry.customer_name,
                customerPhone: inquiry.customer_phone,
                eventDate: inquiry.event_date,
              }}
            />
          )
        )}
        <InquiryDetailActions inquiryId={inquiry.id} status={inquiry.status} />
      </div>
    </div>
  );
}
