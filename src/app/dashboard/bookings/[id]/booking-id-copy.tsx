"use client";

import { toast } from "sonner";
import { CopyButton } from "@merqo/ui";

// The page is a Server Component and cannot pass an onError handler across
// the boundary, so the toast lives in this client wrapper.
export function BookingIdCopy({ bookingId }: { bookingId: string }) {
  return (
    <CopyButton
      value={bookingId}
      label="Copy ID"
      aria-label="Copy booking ID"
      onError={() => toast.error("Could not copy the booking ID")}
    />
  );
}
