"use client";

import { useState } from "react";
import { PhoneFrame } from "@merqo/ui";

import { PayScreen } from "./pay-screen";
import { STATUS, STATUS_ORDER, StatusPill, type Status } from "./status";

/**
 * The hero's product object: the customer's pay page in a phone, with a
 * segmented control that walks it through Waiting, Paid and Confirmed. Client
 * state only, so it works the same with or without reduced motion.
 */
export function CheckoutCard() {
  const [state, setState] = useState<Status>("pending");

  return (
    <figure
      className="flex w-full flex-col items-center gap-5"
      aria-label="Sample paykit pay page"
    >
      <PhoneFrame
        label="Sample pay page on a customer's phone"
        size="large"
        className="h-[340px]"
      >
        <PayScreen status={state} />
      </PhoneFrame>

      <div
        role="group"
        aria-label="Payment status"
        className="flex w-full max-w-[28rem] rounded-lg border border-border p-1"
      >
        {STATUS_ORDER.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={state === s}
            onClick={() => setState(s)}
            className="min-h-11 flex-auto whitespace-nowrap rounded-lg px-2 text-xs font-semibold sm:px-3 sm:text-sm transition-colors hover:bg-muted active:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:hover:bg-foreground/85"
          >
            {STATUS[s].label}
          </button>
        ))}
      </div>
      <p
        className="flex items-center gap-2 text-sm text-muted-foreground"
        aria-live="polite"
      >
        On the vendor&apos;s screen: <StatusPill status={state} />
      </p>
    </figure>
  );
}
