import type { ReactNode } from "react";
import { Check, ScanLine } from "lucide-react";
import QRCode from "react-qr-code";

import { StatusPill, type Status } from "./status";

// A deliberately non-payable payload: the screens are pictures of the pay
// page, so scanning one must never lead anywhere near a real PayNow account.
const SAMPLE_QR_VALUE = "https://paykit.merqo.io/faq";

/**
 * The customer's pay page as it appears inside a phone: amount and QR while
 * the order is awaiting payment, then the "Payment recorded" notice the real
 * page shows once the customer says they have paid. The customer never sees
 * the vendor's confirmation, so Received looks the same as Marked paid here.
 */
export function PayScreen({
  status,
  compact = false,
  action,
}: {
  status: Status;
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
        {status === "pending" ? (
          <QRCode value={SAMPLE_QR_VALUE} size={qr} />
        ) : (
          <span
            className={`flex items-center justify-center rounded-full bg-muted text-foreground ${compact ? "size-10" : "size-16"}`}
          >
            <Check className={compact ? "size-5" : "size-8"} aria-hidden />
          </span>
        )}
      </div>

      {status === "pending" ? (
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          Scan with your bank app, then tap I&apos;ve paid.
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs font-semibold">Payment recorded</p>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
            Ah Seng Kopi has been told. You can close this page.
          </p>
        </>
      )}
      {action && <div className="mt-auto w-full pt-2">{action}</div>}
    </div>
  );
}

const OTHER_ORDERS: readonly { ref: string; amount: string; status: Status }[] =
  [
    { ref: "A82E", amount: "S$12.40", status: "claimed" },
    { ref: "A82D", amount: "S$5.60", status: "pending" },
  ];

function OrderRow({
  orderRef,
  amount,
  status,
  highlight = false,
}: {
  orderRef: string;
  amount: string;
  status: Status;
  highlight?: boolean;
}) {
  return (
    <li
      className={`rounded-lg border p-2 ${highlight ? "border-foreground" : "border-border"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-bold">#{orderRef}</span>
        <span className="font-mono text-xs font-bold">{amount}</span>
      </div>
      <div className="mt-1.5">
        <StatusPill status={status} />
      </div>
    </li>
  );
}

/**
 * What the vendor sees: the Orders list with this journey's order highlighted
 * above two others, the same rows the sample ledger below lists.
 */
export function VendorScreen({
  status,
  action,
}: {
  status: Status;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col text-left">
      <p className="font-display text-[13px] font-semibold">Orders</p>
      <ul className="mt-2 space-y-1.5">
        <OrderRow orderRef="A82F" amount="S$7.80" status={status} highlight />
        {OTHER_ORDERS.map((o) => (
          <OrderRow
            key={o.ref}
            orderRef={o.ref}
            amount={o.amount}
            status={o.status}
          />
        ))}
      </ul>
      {action && <div className="mt-auto pt-2">{action}</div>}
    </div>
  );
}

/** The customer's own bank app: the money moves here, never through paykit. */
export function BankScreen({
  sent,
  action,
}: {
  sent: boolean;
  action?: ReactNode;
}) {
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
      {action && <div className="mt-auto w-full pt-2">{action}</div>}
    </div>
  );
}
