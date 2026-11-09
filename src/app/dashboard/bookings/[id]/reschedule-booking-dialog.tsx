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
  Button,
} from "@merqo/ui/primitives";

import { rescheduleBookingAction } from "../actions";
import { Field } from "../field";

export function RescheduleBookingDialog({
  bookingId,
  eventDate,
  balanceDueDate,
}: {
  bookingId: string;
  eventDate: string;
  balanceDueDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [newEventDate, setNewEventDate] = useState(eventDate);
  const [newBalanceDueDate, setNewBalanceDueDate] = useState(balanceDueDate);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onConfirm() {
    setError(null);
    start(async () => {
      const result = await rescheduleBookingAction(
        bookingId,
        newEventDate,
        newBalanceDueDate,
      );
      if (result.status === "error") {
        setError(
          result.message ?? "Could not reschedule the booking. Try again.",
        );
        return;
      }
      toast.success("Booking rescheduled");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl">
          Reschedule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule this booking?</DialogTitle>
          <DialogDescription>
            A deposit already paid stays counted toward this booking. Only the
            dates change.
          </DialogDescription>
        </DialogHeader>
        <Field
          id="reschedule_event_date"
          label="New event date"
          type="date"
          value={newEventDate}
          onChange={(e) => setNewEventDate(e.target.value)}
        />
        <Field
          id="reschedule_balance_due_date"
          label="New balance due date"
          type="date"
          value={newBalanceDueDate}
          onChange={(e) => setNewBalanceDueDate(e.target.value)}
        />
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
            Keep dates
          </Button>
          <Button className="rounded-xl" disabled={pending} onClick={onConfirm}>
            {pending ? "Rescheduling…" : "Confirm reschedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
