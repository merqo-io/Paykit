import type { Metadata } from "next";
import { getVendorSession } from "@/lib/vendor-session";
import { listBookings } from "@/lib/bookings";
import { getInquiryForm, listOpenInquiries } from "@/lib/inquiry-inbox";
import { BookingTable } from "./booking-table";
import { NewBookingDialog } from "./new-booking-dialog";
import { InquiryFormSettings } from "./inquiry-form-settings";
import { InquiryTable } from "./inquiry-table";

export const metadata: Metadata = {
  title: "Bookings",
};

export default async function BookingsPage() {
  const { user } = await getVendorSession();
  const [bookings, inquiries, inquiryForm] = await Promise.all([
    listBookings(user.id),
    listOpenInquiries(user.id),
    getInquiryForm(user.id),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deposit now, balance later. For weddings, private events, and
            anything else booked ahead of the actual pickup or delivery.
          </p>
        </div>
        <NewBookingDialog />
      </div>

      <section className="mt-8" aria-labelledby="inquiries-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="inquiries-heading" className="text-lg font-semibold">
            Inquiries
          </h2>
          <InquiryFormSettings form={inquiryForm} />
        </div>
        <div className="mt-3">
          <InquiryTable inquiries={inquiries} />
        </div>
      </section>

      <section className="mt-8" aria-labelledby="bookings-heading">
        <h2 id="bookings-heading" className="text-lg font-semibold">
          Your bookings
        </h2>
        <div className="mt-3">
          <BookingTable bookings={bookings} />
        </div>
      </section>
    </div>
  );
}
