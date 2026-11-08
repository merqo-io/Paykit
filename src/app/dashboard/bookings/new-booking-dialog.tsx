"use client";

import { useActionState, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Button,
} from "@merqo/ui/primitives";

import { createBookingAction, type BookingActionState } from "./actions";
import { Field, MoneyField } from "./field";

/** `""` unless total/deposit are both valid numbers with a positive remainder. */
function deriveBalance(total: string, deposit: string): string {
  const t = Number(total);
  const d = Number(deposit);
  if (!Number.isFinite(t) || !Number.isFinite(d)) return "";
  const remainder = Math.round((t - d) * 100) / 100;
  return remainder > 0 ? remainder.toFixed(2) : "";
}

/** Cents-exact check so 0.1 + 0.2 style float drift never blocks a submit. */
function amountsAddUp(total: string, deposit: string, balance: string) {
  const cents = (v: string) => Math.round(Number(v) * 100);
  return cents(deposit) + cents(balance) === cents(total);
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
  const [amountError, setAmountError] = useState<string | null>(null);
  // Once the vendor edits the balance field directly, stop auto-deriving it
  // from total - deposit — same "touched" instinct as `payment-config-
  // form.tsx`'s label-preset wiring.
  const [balanceTouched, setBalanceTouched] = useState(false);

  function handleTotalChange(value: string) {
    setTotalAmount(value);
    setAmountError(null);
    if (!balanceTouched) setBalanceAmount(deriveBalance(value, depositAmount));
  }
  function handleDepositChange(value: string) {
    setDepositAmount(value);
    setAmountError(null);
    if (!balanceTouched) setBalanceAmount(deriveBalance(totalAmount, value));
  }
  function resetAmounts() {
    setTotalAmount("");
    setDepositAmount("");
    setBalanceAmount("");
    setAmountError(null);
    setBalanceTouched(false);
  }

  const [state, formAction, pending] = useActionState<
    BookingActionState,
    FormData
  >(
    async (prevState, formData) => {
      const amounts = [totalAmount, depositAmount, balanceAmount];
      if (!amounts.every((v) => Number.isFinite(Number(v)))) {
        setAmountError("Enter a valid amount.");
        return { status: "idle" };
      }
      if (!amountsAddUp(totalAmount, depositAmount, balanceAmount)) {
        setAmountError("Deposit and balance must add up to the total.");
        return { status: "idle" };
      }
      const result = await createBookingAction(prevState, formData);
      if (result.status === "ok") {
        toast.success(result.message ?? "Booking created");
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
        <Button className="rounded-xl">{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New booking</DialogTitle>
          <DialogDescription>
            Add the customer, the dates and the amounts. A deposit payment is
            created for you.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          {prefill && (
            <input type="hidden" name="inquiry_id" value={prefill.inquiryId} />
          )}
          <Field
            id="customer_name"
            name="customer_name"
            label="Customer name"
            placeholder="Jane Tan"
            defaultValue={prefill?.customerName}
            required
          />
          <Field
            id="customer_phone"
            name="customer_phone"
            label="Customer phone (optional)"
            placeholder="+6591234567"
            type="tel"
            defaultValue={prefill?.customerPhone}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id="event_date"
              name="event_date"
              label="Event date"
              type="date"
              defaultValue={prefill?.eventDate ?? undefined}
              required
            />
            <Field
              id="balance_due_date"
              name="balance_due_date"
              label="Balance due date"
              type="date"
              required
            />
          </div>
          <MoneyField
            id="total_amount"
            name="total_amount"
            label="Total amount"
            placeholder="1000.00"
            value={totalAmount}
            onChange={(e) => handleTotalChange(e.target.value)}
            required
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <MoneyField
              id="deposit_amount"
              name="deposit_amount"
              label="Deposit"
              placeholder="300.00"
              value={depositAmount}
              onChange={(e) => handleDepositChange(e.target.value)}
              required
            />
            <MoneyField
              id="balance_amount"
              name="balance_amount"
              label="Balance"
              placeholder="700.00"
              value={balanceAmount}
              error={amountError}
              onChange={(e) => {
                setBalanceAmount(e.target.value);
                setBalanceTouched(true);
                setAmountError(null);
              }}
              required
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Deposit and balance must add up to the total.
          </p>
          {state.status === "error" && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {state.message}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="rounded-xl" disabled={pending}>
              {pending ? "Creating…" : "Create booking"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
