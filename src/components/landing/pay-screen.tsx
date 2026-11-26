import type { ReactNode } from "react";
import { Check, ScanLine } from "lucide-react";
import QRCode from "react-qr-code";

export type PayState = "waiting" | "paid" | "confirmed";

export const PAY_STATES: readonly { id: PayState; label: string }[] = [
  { id: "waiting", label: "Waiting" },
  { id: "paid", label: "Paid" },
  { id: "confirmed", label: "Confirmed" },
];

// A deliberately non-payable payload: the screens are pictures of the pay
// page, so scanning one must never lead anywhere near a real PayNow account.
const SAMPLE_QR_VALUE = "https://paykit.merqo.io/faq";

const DOT: Record<PayState, string> = {
  waiting: "bg-muted-foreground",
  paid: "bg-flow",
  confirmed: "bg-mint",
};

export function StatusPill({ state }: { state: PayState }) {
  const label = PAY_STATES.find((s) => s.id === state)?.label;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-semibold">
      <span aria-hidden className={`size-2 rounded-full ${DOT[state]}`} />
      {label}
    </span>
  );
}

const SAY: Record<PayState, string> = {
  waiting: "Scan with your bank app.",
  paid: "You said paid. Ah Seng Kopi checks the payment.",
  confirmed: "Ah Seng Kopi confirmed it. You are done.",
};

/**
 * The customer's pay page as it appears inside a phone: amount, then the QR
 * while waiting, then the status the vendor's confirmation moves along.
 */
export function PayScreen({
  state,
  compact = false,
  action,
}: {
  state: PayState;
  compact?: boolean;
  action?: ReactNode;
}) {
  const qr = compact ? 76 : 132;
  return (
    <div className="flex h-full min-h-0 flex-col items-center text-center">
      <p
        className={`font-display font-semibold ${compact ? "text-[13px]" : "text-base"}`}
      >
        Paying Ah Seng Kopi
      </p>
      <p className={`font-mono font-bold ${compact ? "text-xl" : "text-3xl"}`}>
        S$7.80
      </p>
      {!compact && (
        <p className="text-[11px] text-muted-foreground">Order #A82F</p>
      )}

      <div
        className={`mt-2 flex items-center justify-center rounded-lg border border-border bg-white ${compact ? "size-[92px]" : "size-[152px]"}`}
      >
        {state === "waiting" ? (
          <QRCode value={SAMPLE_QR_VALUE} size={qr} />
        ) : (
          <span
            className={`flex items-center justify-center rounded-full ${compact ? "size-10" : "size-16"} ${state === "paid" ? "bg-flow/20 text-neutral-900" : "bg-mint text-mint-foreground"}`}
          >
            <Check className={compact ? "size-5" : "size-8"} aria-hidden />
          </span>
        )}
      </div>

      <div className="mt-2">
        <StatusPill state={state} />
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
        {SAY[state]}
      </p>
      {action && <div className="mt-auto w-full pt-2">{action}</div>}
    </div>
  );
}

/** What the vendor sees for the same order, in the kit that took it. */
export function VendorScreen({
  state,
  action,
}: {
  state: "empty" | "paid" | "confirmed";
  action?: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col text-left">
      <p className="font-display text-[13px] font-semibold">Orders</p>
      {state === "empty" ? (
        <p className="mt-6 text-center text-[11px] text-muted-foreground">
          No payments yet.
        </p>
      ) : (
        <div className="mt-2 rounded-lg border border-border p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-xs font-bold">#A82F</span>
            <span className="font-mono text-xs font-bold">S$7.80</span>
          </div>
          <div className="mt-1.5">
            <StatusPill state={state === "paid" ? "paid" : "confirmed"} />
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
            {state === "paid"
              ? "Says paid. Check your bank."
              : "Seen in your bank. Done."}
          </p>
        </div>
      )}
      {action && <div className="mt-auto pt-2">{action}</div>}
    </div>
  );
}

/** The customer's own bank app: the money moves here, never through paykit. */
export function BankScreen({ sent }: { sent: boolean }) {
  return (
    <div className="flex h-full min-h-0 flex-col items-center text-center">
      <p className="font-display text-[13px] font-semibold">Your bank</p>
      {sent ? (
        <>
          <span className="mt-4 flex size-12 items-center justify-center rounded-full bg-mint text-mint-foreground">
            <Check className="size-6" aria-hidden />
          </span>
          <p className="mt-2 font-mono text-xl font-bold">S$7.80</p>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Sent by PayNow to Ah Seng Kopi.
          </p>
        </>
      ) : (
        <>
          <span className="mt-4 flex size-[92px] items-center justify-center rounded-lg border-[1.5px] border-dashed border-border text-muted-foreground">
            <ScanLine className="size-8" aria-hidden />
          </span>
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
            Point the camera at the QR.
          </p>
        </>
      )}
    </div>
  );
}
