"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import QRCode from "react-qr-code";
import { Money, PhoneFrame } from "@merqo/ui";

// A deliberately non-payable payload: the phone is a picture of the pay step,
// so scanning it must never lead anywhere near a real PayNow account.
const SAMPLE_QR_VALUE = "https://paykit.merqo.io/faq";

// Illustrative items and prices, not a real stall's menu.
const ITEMS = [
  { name: "Kopi", option: "Iced", qty: 1, cents: 180 },
  { name: "Kaya Toast", option: "", qty: 1, cents: 250 },
] as const;
const TOTAL_CENTS = ITEMS.reduce((sum, i) => sum + i.qty * i.cents, 0);

/**
 * A customer's phone in qkit: the order they placed and the PayNow QR paykit
 * made for it, with the "I've paid" tap leading to the recorded state. Only a
 * tap moves it, so reduced motion needs no special case.
 */
function Screen() {
  const [sent, setSent] = useState(false);
  const paidRef = useRef<HTMLButtonElement>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);

  // The tapped button unmounts, so focus follows to its replacement; skipped
  // on first render so the page does not grab focus on load.
  useEffect(() => {
    if (!moved.current) return;
    (sent ? undoRef : paidRef).current?.focus();
  }, [sent]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="font-display text-xl font-semibold">Kopitiam Cart</p>
      <p className="text-xs text-muted-foreground">Stall 14</p>

      <ul className="mt-3 divide-y divide-border border-y border-dashed border-border text-sm">
        {ITEMS.map((i) => (
          <li key={i.name} className="flex justify-between gap-2 py-1.5">
            <span className="min-w-0">
              <span className="font-mono text-muted-foreground">{i.qty}×</span>{" "}
              {i.name}
              {i.option && (
                <span className="ml-1 text-xs text-muted-foreground">
                  {i.option}
                </span>
              )}
            </span>
            <span className="shrink-0 font-mono text-muted-foreground">
              <Money cents={i.qty * i.cents} />
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex items-baseline justify-between font-semibold">
        <span>Total</span>
        <span className="font-mono text-lg font-bold">
          <Money cents={TOTAL_CENTS} />
        </span>
      </p>

      <div
        role="status"
        aria-live="polite"
        className={sent ? "mt-4 text-center" : "sr-only"}
      >
        {sent && (
          <>
            <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-mint/15 text-mint">
              <Check className="size-6" aria-hidden />
            </span>
            <p className="mt-2 text-sm font-semibold">
              Payment sent. The stall is checking it.
            </p>
          </>
        )}
      </div>
      {sent ? (
        <div className="flex flex-1 flex-col items-center text-center">
          <button
            ref={undoRef}
            type="button"
            onClick={() => {
              moved.current = true;
              setSent(false);
            }}
            className="inline-flex min-h-11 items-center px-3 text-sm font-medium text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Tapped by mistake? Undo
          </button>
        </div>
      ) : (
        <>
          <div className="mt-3 flex flex-1 flex-col items-center justify-center gap-2">
            <div className="rounded-lg border border-border bg-white p-2">
              <QRCode value={SAMPLE_QR_VALUE} size={116} />
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Scan with any PayNow banking app. The amount is already filled in.
            </p>
          </div>
          <button
            ref={paidRef}
            type="button"
            onClick={() => {
              moved.current = true;
              setSent(true);
            }}
            className="mt-2 flex h-12 w-full items-center justify-center rounded-lg bg-foreground text-sm font-bold text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:brightness-90"
          >
            I&apos;ve paid
          </button>
        </>
      )}
    </div>
  );
}

export function QkitPhone() {
  return (
    <figure
      id="how"
      className="flex w-full scroll-mt-24 flex-col items-center gap-4"
    >
      <PhoneFrame
        label="A customer's order in qkit, with its PayNow QR"
        size="large"
        className="min-h-[520px]"
      >
        <Screen />
      </PhoneFrame>
      <figcaption className="text-sm text-muted-foreground">
        A qkit order, paid by PayNow through paykit
      </figcaption>
    </figure>
  );
}
