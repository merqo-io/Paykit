"use client";

import { useState } from "react";
import { PhoneFrame } from "@merqo/ui";

import { PAY_STATES, PayScreen, type PayState } from "./pay-screen";

/**
 * The hero's product object: the customer's pay page in a phone, with a
 * segmented control that walks it through Waiting, Paid and Confirmed. Client
 * state only, so it works the same with or without reduced motion.
 */
export function CheckoutCard() {
  const [state, setState] = useState<PayState>("waiting");

  return (
    <figure
      className="flex w-full flex-col items-center gap-5"
      aria-label="Sample paykit pay page"
    >
      <PhoneFrame label="Sample pay page on a customer's phone" size="large">
        <PayScreen state={state} />
      </PhoneFrame>

      <div
        role="group"
        aria-label="Payment status"
        className="flex w-full max-w-[19rem] rounded-lg border border-border p-1"
      >
        {PAY_STATES.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={state === s.id}
            onClick={() => setState(s.id)}
            className="min-h-11 flex-1 rounded-lg px-2 text-sm font-semibold transition-colors hover:bg-muted active:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:hover:bg-foreground/85"
          >
            {s.label}
          </button>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        Status: {PAY_STATES.find((s) => s.id === state)?.label}
      </p>
    </figure>
  );
}
