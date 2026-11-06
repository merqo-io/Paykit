"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createBalanceCheckoutAction } from "../actions";

export function CreateBalanceCheckoutButton({
  bookingId,
}: {
  bookingId: string;
}) {
  const [pending, start] = useTransition();

  function onClick() {
    start(async () => {
      const result = await createBalanceCheckoutAction(bookingId);
      if (result.status === "error") {
        toast.error(
          result.message ?? "Could not create the balance payment. Try again.",
        );
        return;
      }
      toast.success("Balance payment created");
    });
  }

  return (
    <Button size="sm" disabled={pending} onClick={onClick}>
      {pending ? "Creating…" : "Create balance payment"}
    </Button>
  );
}
