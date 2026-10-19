import type { Metadata } from "next";
import { getVendorSession } from "@/lib/vendor-session";
import { listBookings } from "@/lib/bookings";
import { BookingTable } from "./booking-table";
import { NewBookingDialog } from "./new-booking-dialog";

export const metadata: Metadata = {
  title: "Bookings",
};

export default async function BookingsPage() {
  const { user } = await getVendorSession();
  const bookings = await listBookings(user.id);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Deposit now, balance later — for weddings, private events, and
            anything else booked ahead of the actual pickup or delivery.
          </p>
        </div>
        <NewBookingDialog />
      </div>
      <div className="mt-6">
        <BookingTable bookings={bookings} />
      </div>
    </div>
  );
}
