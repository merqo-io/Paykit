import Link from "next/link";
import { FORM_LABEL_CLASS } from "@merqo/ui";
import { Button, Input, Label } from "@merqo/ui/primitives";
import { FILTER_SELECT_CLASS } from "@/components/list/filter-classes";
import {
  BOOKING_STATUS_FILTERS,
  bookingListHref,
  hasActiveFilters,
  type BookingListParams,
} from "./list-params";

const STATUS_LABELS: Record<(typeof BOOKING_STATUS_FILTERS)[number], string> = {
  pending_deposit: "Awaiting deposit",
  deposit_paid: "Deposit paid",
  fully_paid: "Fully paid",
  cancelled: "Cancelled",
};

// A plain GET form: the URL is the single source of truth, so filters survive
// reload and sharing, and the list needs no client state.
export function BookingFilters({ params }: { params: BookingListParams }) {
  return (
    <form
      method="get"
      action="/dashboard/bookings"
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      role="search"
    >
      <div className="grid gap-1.5 sm:flex-1">
        <Label htmlFor="booking-search" className={FORM_LABEL_CLASS}>
          Search
        </Label>
        <Input
          id="booking-search"
          name="q"
          type="search"
          defaultValue={params.q}
          placeholder="Customer name or phone"
          maxLength={80}
        />
      </div>
      <div className="grid gap-1.5 sm:w-48">
        <Label htmlFor="booking-status" className={FORM_LABEL_CLASS}>
          Status
        </Label>
        <select
          id="booking-status"
          name="status"
          defaultValue={params.status ?? ""}
          className={FILTER_SELECT_CLASS}
        >
          <option value="">All statuses</option>
          {BOOKING_STATUS_FILTERS.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit">Apply</Button>
        {hasActiveFilters(params) && (
          <Link
            href={bookingListHref({})}
            className="text-sm underline underline-offset-4"
          >
            Clear filters
          </Link>
        )}
      </div>
    </form>
  );
}
