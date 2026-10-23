"use client";

import { useActionState } from "react";
import { DataCollectionNotice } from "@merqo/ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitInquiryAction, type InquiryActionState } from "./actions";

export type InquiryFormProps = {
  publicId: string;
  businessName: string;
  terms: { url: string; version: string } | null;
  startedAt: number;
};

export function InquiryForm({
  publicId,
  businessName,
  terms,
  startedAt,
}: InquiryFormProps) {
  const [state, formAction, pending] = useActionState<
    InquiryActionState,
    FormData
  >(submitInquiryAction.bind(null, publicId), { status: "idle" });

  if (state.status === "sent") {
    return (
      <div className="space-y-3 text-center" role="status">
        <h1 className="font-display text-2xl font-semibold text-balance">
          Inquiry sent
        </h1>
        <p className="text-sm text-muted-foreground">
          {businessName} will contact you. You can close this page.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold text-balance">
          {businessName}
        </h1>
        <p className="text-sm text-muted-foreground">
          Tell us about your event and we will get back to you.
        </p>
      </div>

      <input type="hidden" name="started_at" value={startedAt} />
      <div aria-hidden="true" className="hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="customer_name">Your name</Label>
        <Input
          id="customer_name"
          name="customer_name"
          autoComplete="name"
          maxLength={80}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="customer_phone">Phone number</Label>
        <Input
          id="customer_phone"
          name="customer_phone"
          type="tel"
          autoComplete="tel"
          placeholder="+65 9123 4567"
          maxLength={20}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="event_date">Event date (optional)</Label>
        <Input id="event_date" name="event_date" type="date" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="message">About your event</Label>
        <Textarea
          id="message"
          name="message"
          rows={5}
          maxLength={2000}
          placeholder="Type of event, number of guests, venue, what you need."
          required
        />
      </div>

      {terms && (
        <div className="flex items-start gap-3">
          <Checkbox
            id="terms_accepted"
            name="terms_accepted"
            required
            className="mt-0.5"
          />
          <Label htmlFor="terms_accepted" className="leading-snug font-normal">
            <span>
              I have read and agree to {businessName}&apos;s{" "}
              <a
                href={terms.url}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                booking terms
              </a>{" "}
              (version {terms.version}).
            </span>
          </Label>
        </div>
      )}

      <DataCollectionNotice
        purpose={`pass your inquiry to ${businessName} so they can reply`}
      />

      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending…" : "Send inquiry"}
      </Button>
    </form>
  );
}
