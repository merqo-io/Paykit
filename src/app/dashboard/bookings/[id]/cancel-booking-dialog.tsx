"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cancelBookingAction } from "../actions";
import { MoneyField } from "../field";
import type { Transaction } from "@/lib/types";

// A refund only makes sense against a single, unambiguous transaction — if
// both deposit and balance are already confirmed, this dialog doesn't try
// to guess which one; the vendor can still file a refund per-transaction
// from the transactions page's own existing refund action.
function refundableTransaction(
  depositTx: Transaction | null,
  balanceTx: Transaction | null,
): Transaction | null {
  const confirmed = [depositTx, balanceTx].filter(
    (tx): tx is Transaction => tx?.status === "confirmed",
  );
  return confirmed.length === 1 ? confirmed[0] : null;
}

export function CancelBookingDialog({
  bookingId,
  depositTx = null,
  balanceTx = null,
  isPro = true,
}: {
  bookingId: string;
  depositTx?: Transaction | null;
  balanceTx?: Transaction | null;
  /** Refund tracking is Pro-gated; free vendors see a hint instead. */
  isPro?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const refundTx = refundableTransaction(depositTx, balanceTx);

  function onConfirm() {
    setError(null);
    setAmountError(null);
    const wantsRefund =
      Boolean(refundTx) && isPro && refundAmount.trim() !== "";
    if (
      wantsRefund &&
      (!Number.isFinite(Number(refundAmount)) || Number(refundAmount) <= 0)
    ) {
      setAmountError("Enter an amount greater than 0.");
      return;
    }
    start(async () => {
      const amountCents = Math.round(Number(refundAmount) * 100);
      const refund =
        refundTx && wantsRefund && amountCents > 0
          ? { transactionId: refundTx.id, amountCents }
          : undefined;
      const result = refund
        ? await cancelBookingAction(bookingId, reason, refund)
        : await cancelBookingAction(bookingId, reason);
      if (result.status === "error") {
        setError(result.message ?? "Could not cancel the booking. Try again.");
        return;
      }
      toast.success(result.message ?? "Booking cancelled");
      setReason("");
      setRefundAmount("");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl">
          Cancel booking
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this booking?</DialogTitle>
          <DialogDescription>
            This only marks the booking cancelled. It never changes the status
            of any payment already made.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="cancel_reason">Reason (optional)</Label>
          <Textarea
            id="cancel_reason"
            className="rounded-xl shadow-none"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        {refundTx && isPro && (
          <MoneyField
            id="cancel_refund_amount"
            label="Refund amount (optional)"
            value={refundAmount}
            onChange={(e) => {
              setRefundAmount(e.target.value);
              setAmountError(null);
            }}
            placeholder="0.00"
            error={amountError}
          />
        )}
        {refundTx && !isPro && (
          <p
            id="cancel_refund_hint"
            className="rounded-xl border border-dashed p-3 text-sm text-muted-foreground"
          >
            Refund tracking is on the Pro plan. You can still cancel this
            booking.
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => setOpen(false)}
          >
            Keep booking
          </Button>
          <Button
            variant="destructive"
            className="rounded-xl"
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "Cancelling…" : "Confirm cancellation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
