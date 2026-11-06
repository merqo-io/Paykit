"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  function remove() {
    start(async () => {
      const result = await deleteInquiryAction(inquiryId);
      if (result.status === "error") {
        toast.error(toastText(result.message));
        return;
      }
      toast.success("Inquiry deleted");
      router.push("/dashboard/bookings");
    });
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
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" disabled={pending}>
            Delete
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this inquiry?</DialogTitle>
            <DialogDescription>
              The client&apos;s details and message are removed for good. Do
              this when a client asks you to delete their data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => setConfirmOpen(false)}
            >
              Keep inquiry
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl"
              disabled={pending}
              onClick={remove}
            >
              Delete inquiry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
