import { checkoutKind } from "@/lib/checkout-kind";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { cn, formatCents } from "@/lib/utils";
import type { Transaction, TxStatus } from "@/lib/types";

// Same treatment as `dashboard/transactions/transaction-table.tsx` — `claimed`
// is the one status that actually needs the vendor's attention right now.
const STATUS_BADGE_CLASS: Partial<Record<TxStatus, string>> = {
  claimed: "bg-mint/15 text-mint ring-1 ring-mint/30",
};

// `qrMarkup` is rendered by the (server) page via @merqo/ui's `qrSvg` and
// passed down as a plain string, rather than generated here: `qrSvg` is
// async, and an async child cannot be rendered by this page's jsdom test.
export function TransactionStatusCard({
  label,
  transaction,
  qrMarkup,
}: {
  label: string;
  transaction: Transaction | null;
  qrMarkup: string | null;
}) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {!transaction ? (
        <p className="mt-2 text-sm text-muted-foreground">Not yet created.</p>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-2">
            <Badge
              variant={
                transaction.status === "confirmed" ? "default" : "secondary"
              }
              className={cn(STATUS_BADGE_CLASS[transaction.status])}
            >
              {transaction.status}
            </Badge>
            <span className="text-sm font-medium">
              {formatCents(transaction.amount_cents)}
            </span>
          </div>
          <PaymentDisplay
            transaction={transaction}
            label={label}
            qrMarkup={qrMarkup}
          />
        </>
      )}
    </div>
  );
}

function PaymentDisplay({
  transaction,
  label,
  qrMarkup,
}: {
  transaction: Transaction;
  label: string;
  qrMarkup: string | null;
}) {
  if (checkoutKind(transaction) === "qr")
    return (
      <div
        className="mt-3 w-40 [&_svg]:h-auto [&_svg]:w-full"
        // SVG from qrSvg() over the transaction's server-built payload, never user text
        dangerouslySetInnerHTML={{ __html: qrMarkup ?? "" }}
      />
    );
  if (transaction.checkout_kind === "image")
    return (
      <Image
        src={transaction.qr_payload}
        alt={label + " payment QR code"}
        width={160}
        height={160}
        unoptimized
        className="mt-3"
      />
    );
  if (transaction.checkout_kind === "link")
    return (
      <a
        href={transaction.qr_payload}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block underline"
      >
        {transaction.checkout_label ?? "Open payment link"}
      </a>
    );
  return (
    <p className="mt-3 text-sm text-muted-foreground">
      Original payment display unavailable for this older checkout. Check the
      original payment instructions.
    </p>
  );
}
