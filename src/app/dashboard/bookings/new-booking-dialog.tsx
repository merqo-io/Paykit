"use client";

import { useActionState, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createBookingAction, type BookingActionState } from "./actions";

/** `""` unless total/deposit are both valid numbers with a positive remainder. */
function deriveBalance(total: string, deposit: string): string {
  const t = Number(total);
  const d = Number(deposit);
  if (!Number.isFinite(t) || !Number.isFinite(d)) return "";
  const remainder = Math.round((t - d) * 100) / 100;
  return remainder > 0 ? remainder.toFixed(2) : "";
}

export type BookingPrefill = {
  inquiryId: string;
  customerName: string;
  customerPhone: string;
  eventDate: string | null;
};

export function NewBookingDialog({
  prefill,
  triggerLabel = "New booking",
}: {
  prefill?: BookingPrefill;
  triggerLabel?: string;
} = {}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [totalAmount, setTotalAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [balanceAmount, setBalanceAmount] = useState("");
  // Once the vendor edits the balance field directly, stop auto-deriving it
  // from total - deposit — same "touched" instinct as `payment-config-
  // form.tsx`'s label-preset wiring.
  const [balanceTouched, setBalanceTouched] = useState(false);

  function handleTotalChange(value: string) {
    setTotalAmount(value);
    if (!balanceTouched) setBalanceAmount(deriveBalance(value, depositAmount));
  }
  function handleDepositChange(value: string) {
    setDepositAmount(value);
    if (!balanceTouched) setBalanceAmount(deriveBalance(totalAmount, value));
  }
  function resetAmounts() {
    setTotalAmount("");
    setDepositAmount("");
    setBalanceAmount("");
    setBalanceTouched(false);
  }

  const [state, formAction, pending] = useActionState<
    BookingActionState,
    FormData
  >(
    async (prevState, formData) => {
      const result = await createBookingAction(prevState, formData);
      if (result.status === "ok") {
        toast.success(result.message ?? "Booking created.");
        formRef.current?.reset();
        resetAmounts();
        setOpen(false);
      }
      return result;
    },
    { status: "idle" },
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New booking</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          {prefill && (
            <input type="hidden" name="inquiry_id" value={prefill.inquiryId} />
          )}
          <div className="space-y-2">
            <Label htmlFor="customer_name">Customer name</Label>
            <Input
              id="customer_name"
              name="customer_name"
              placeholder="Jane Tan"
              defaultValue={prefill?.customerName}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer_phone">Customer phone (optional)</Label>
            <Input
              id="customer_phone"
              name="customer_phone"
              placeholder="+6591234567"
              defaultValue={prefill?.customerPhone}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="event_date">Event date</Label>
              <Input
                id="event_date"
                name="event_date"
                type="date"
                defaultValue={prefill?.eventDate ?? undefined}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="balance_due_date">Balance due date</Label>
              <Input
                id="balance_due_date"
                name="balance_due_date"
                type="date"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="total_amount">Total amount</Label>
            <Input
              id="total_amount"
              name="total_amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="1000.00"
              value={totalAmount}
              onChange={(e) => handleTotalChange(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deposit_amount">Deposit</Label>
              <Input
                id="deposit_amount"
                name="deposit_amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="300.00"
                value={depositAmount}
                onChange={(e) => handleDepositChange(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="balance_amount">Balance</Label>
              <Input
                id="balance_amount"
                name="balance_amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="700.00"
                value={balanceAmount}
                onChange={(e) => {
                  setBalanceAmount(e.target.value);
                  setBalanceTouched(true);
                }}
                required
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Deposit + balance must add up to the total.
          </p>
          {state.status === "error" && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {state.message}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create booking"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
