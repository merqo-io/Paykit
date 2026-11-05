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
import { issueRefundAction, type RefundState } from "./actions";

export function RefundDialog({ transactionId }: { transactionId: string }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  // A successful refund closes the dialog and clears the form — leaving it
  // open with the same amount/reason still filled in and the submit button
  // re-enabled invites an accidental duplicate refund. Handled inline in
  // this action wrapper (not a useEffect keyed on the result) so the
  // follow-up state updates happen as part of the submit itself, not a
  // separate render pass.
  const [state, formAction, pending] = useActionState<RefundState, FormData>(
    async (prevState, formData) => {
      const result = await issueRefundAction(prevState, formData);
      if (result.status === "ok") {
        toast.success("Refund recorded");
        formRef.current?.reset();
        setOpen(false);
      }
      return result;
    },
    { status: "idle" },
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Refund
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue a refund</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <input type="hidden" name="transaction_id" value={transactionId} />
          <div className="space-y-2">
            <Label htmlFor="refunded_amount">Amount</Label>
            <Input
              id="refunded_amount"
              name="refunded_amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="4.50"
              required
            />
            <p className="text-xs text-muted-foreground">
              In dollars, same as the amount shown in the table (e.g. 4.50).
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Input id="reason" name="reason" />
          </div>
          {state.status === "error" && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {state.message}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Recording…" : "Record refund"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
