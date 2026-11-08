"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@merqo/ui/primitives";

export function CopyBookingIdButton({ bookingId }: { bookingId: string }) {
  async function copyId() {
    await navigator.clipboard.writeText(bookingId);
    toast.success("Booking ID copied");
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="rounded-lg"
      onClick={copyId}
      aria-label="Copy booking ID"
    >
      <Copy className="size-3.5" />
      Copy ID
    </Button>
  );
}
