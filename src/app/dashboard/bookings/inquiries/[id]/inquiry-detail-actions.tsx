"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ConfirmDialog } from "@merqo/ui";
import { Button } from "@merqo/ui/primitives";

import {
  deleteInquiryAction,
  setInquiryStatusAction,
} from "../../inquiry-actions";
import { toastText } from "../../toast-text";
import type { InquiryStatus } from "@/lib/types";

export function InquiryDetailActions({
  inquiryId,
  status,
}: {
  inquiryId: string;
  status: InquiryStatus;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function setStatus(next: "contacted" | "declined") {
    start(async () => {
      const result = await setInquiryStatusAction(inquiryId, next);
      if (result.status === "error") toast.error(toastText(result.message));
      else
        toast.success(
          next === "contacted" ? "Marked contacted" : "Inquiry declined",
        );
    });
  }

  async function remove() {
    const result = await deleteInquiryAction(inquiryId);
    if (result.status === "error") throw new Error(toastText(result.message));
    toast.success("Inquiry deleted");
    router.push("/dashboard/bookings");
  }

  return (
    <>
      {status === "new" && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => setStatus("contacted")}
        >
          Mark contacted
        </Button>
      )}
      {status !== "declined" && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => setStatus("declined")}
        >
          Decline
        </Button>
      )}
      <ConfirmDialog
        trigger={
          <Button variant="ghost" size="sm" disabled={pending}>
            Delete
          </Button>
        }
        title="Delete this inquiry?"
        description="Do this when a client asks you to delete their data."
        consequence="The client's details and message are removed for good and cannot be recovered."
        variant="destructive"
        confirmLabel="Delete inquiry"
        cancelLabel="Keep inquiry"
        pendingLabel="Deleting"
        onConfirm={remove}
      />
    </>
  );
}
