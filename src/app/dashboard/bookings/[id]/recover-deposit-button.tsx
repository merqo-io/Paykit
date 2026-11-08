"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@merqo/ui/primitives";

import { recoverDepositCheckoutAction } from "../deposit-actions";
import { toastText } from "../toast-text";

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
                toastText(
                  result.message ??
                    "Could not recover the deposit payment. Try again.",
                ),
              );
            else toast.success("Deposit payment ready");
          } catch {
            toast.error(
              toastText("Could not recover the deposit payment. Try again."),
            );
          }
        })
      }
    >
      {pending ? "Recovering…" : "Retry deposit payment"}
    </Button>
  );
}
