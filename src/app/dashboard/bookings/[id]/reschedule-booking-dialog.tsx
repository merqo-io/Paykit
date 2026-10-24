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
import { Input } from "@/components/ui/input";
import { rescheduleBookingAction } from "../actions";

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
        setError(result.message ?? "Could not reschedule booking.");
        return;
      }
      toast.success("Booking rescheduled.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Reschedule
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reschedule this booking?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          A deposit already paid stays counted toward this booking. Only the
          dates change.
        </p>
        <div className="space-y-2">
          <Label htmlFor="reschedule_event_date">New event date</Label>
          <Input
            id="reschedule_event_date"
            type="date"
            value={newEventDate}
            onChange={(e) => setNewEventDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reschedule_balance_due_date">
            New balance due date
          </Label>
          <Input
            id="reschedule_balance_due_date"
            type="date"
            value={newBalanceDueDate}
            onChange={(e) => setNewBalanceDueDate(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <Button disabled={pending} onClick={onConfirm}>
          {pending ? "Rescheduling…" : "Confirm reschedule"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
