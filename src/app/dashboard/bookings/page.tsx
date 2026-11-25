import type { Metadata } from "next";
import { PageHeader } from "@merqo/ui";
import { getVendorSession } from "@/lib/vendor-session";
import { searchBookings } from "@/lib/bookings";
import { getInquiryForm, listOpenInquiries } from "@/lib/inquiry-inbox";
import { BookingFilters, BookingPager } from "./booking-filters";
import { BookingTable } from "./booking-table";
import { NewBookingDialog } from "./new-booking-dialog";
import { InquiryFormSettings } from "./inquiry-form-settings";
import { InquiryTable } from "./inquiry-table";
import {
  BOOKING_PAGE_SIZE,
  hasActiveFilters,
  parseBookingListParams,
} from "./list-params";

export const metadata: Metadata = {
  title: "Bookings",
};

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseBookingListParams(await searchParams);
  const { user } = await getVendorSession();
  const [{ rows: bookings, total }, inquiries, inquiryForm] = await Promise.all(
    [
      searchBookings(user.id, { ...params, pageSize: BOOKING_PAGE_SIZE }),
      listOpenInquiries(user.id),
      getInquiryForm(user.id),
    ],
  );
  const filtered = hasActiveFilters(params);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        responsive
        title="Bookings"
        description="Deposit now, balance later, for events booked ahead."
        action={<NewBookingDialog />}
      />

      <section aria-labelledby="inquiries-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="inquiries-heading" className="text-lg font-semibold">
            Inquiries{" "}
            <span className="font-normal tabular-nums text-muted-foreground">
              ({inquiries.length})
            </span>
          </h2>
          <InquiryFormSettings form={inquiryForm} />
        </div>
        <div className="mt-3">
          <InquiryTable inquiries={inquiries} />
        </div>
      </section>

      <section className="mt-10" aria-labelledby="bookings-heading">
        <h2 id="bookings-heading" className="text-lg font-semibold">
          Your bookings{" "}
          <span className="font-normal tabular-nums text-muted-foreground">
            ({total})
          </span>
        </h2>
        <div className="mt-3">
          <BookingFilters params={params} />
        </div>
        <div className="mt-4">
          <BookingTable bookings={bookings} filtered={filtered} />
        </div>
        <BookingPager
          params={params}
          total={total}
          pageSize={BOOKING_PAGE_SIZE}
        />
      </section>
    </div>
  );
}
