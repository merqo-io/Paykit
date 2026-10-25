"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { cancelBookingAction } from "../actions";
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
}: {
  bookingId: string;
  depositTx?: Transaction | null;
  balanceTx?: Transaction | null;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const refundTx = refundableTransaction(depositTx, balanceTx);

  function onConfirm() {
    setError(null);
    start(async () => {
      const amountCents = Math.round(Number(refundAmount) * 100);
      const refund =
        refundTx && refundAmount && amountCents > 0
          ? { transactionId: refundTx.id, amountCents }
          : undefined;
      const result = refund
        ? await cancelBookingAction(bookingId, reason, refund)
        : await cancelBookingAction(bookingId, reason);
      if (result.status === "error") {
        setError(result.message ?? "Could not cancel booking.");
        return;
      }
      toast.success(result.message ?? "Booking cancelled.");
      setReason("");
      setRefundAmount("");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Cancel booking
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this booking?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This only marks the booking cancelled. It never changes the status of
          any payment already made.
        </p>
        <div className="space-y-2">
          <Label htmlFor="cancel_reason">Reason (optional)</Label>
          <Textarea
            id="cancel_reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        {refundTx && (
          <div className="space-y-2">
            <Label htmlFor="cancel_refund_amount">
              Refund amount (optional, Pro only)
            </Label>
            <Input
              id="cancel_refund_amount"
              type="number"
              min="0"
              step="0.01"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <Button variant="destructive" disabled={pending} onClick={onConfirm}>
          {pending ? "Cancelling…" : "Confirm cancellation"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
