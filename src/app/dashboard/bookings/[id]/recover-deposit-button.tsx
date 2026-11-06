"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { recoverDepositCheckoutAction } from "../deposit-actions";

export function RecoverDepositButton({ bookingId }: { bookingId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            const result = await recoverDepositCheckoutAction(bookingId);
            if (result.status === "error")
              toast.error(
                result.message ??
                  "Could not recover the deposit payment. Try again.",
              );
            else toast.success("Deposit payment ready");
          } catch {
            toast.error("Could not recover the deposit payment. Try again.");
          }
        })
      }
    >
      {pending ? "Recovering…" : "Retry deposit payment"}
    </Button>
  );
}
