import type { Metadata } from "next";
import { checkoutKind } from "@/lib/checkout-kind";
import { RecoverDepositButton } from "./recover-deposit-button";
import { notFound } from "next/navigation";
import { qrSvg } from "@merqo/ui";
import { getVendorSession } from "@/lib/vendor-session";
import { getBooking } from "@/lib/bookings";
import { getTransaction } from "@/lib/transactions";
import { formatCents, formatDate } from "@/lib/utils";
import { BookingStatusBadge, BalanceDueIndicator } from "../booking-badges";
import { TransactionStatusCard } from "./transaction-status-card";
import { CreateBalanceCheckoutButton } from "./create-balance-checkout-button";
import { CancelBookingDialog } from "./cancel-booking-dialog";
import { RescheduleBookingDialog } from "./reschedule-booking-dialog";
import { PrintBookingButton } from "./print-booking-button";
import { CopyBookingIdButton } from "./copy-booking-id-button";

export const metadata: Metadata = {
  title: "Booking",
};

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user } = await getVendorSession();
  const booking = await getBooking(user.id, id);
  if (!booking) notFound();

  const [depositTx, balanceTx] = await Promise.all([
    booking.deposit_transaction_id
      ? getTransaction(user.id, booking.deposit_transaction_id)
      : Promise.resolve(null),
    booking.balance_transaction_id
      ? getTransaction(user.id, booking.balance_transaction_id)
      : Promise.resolve(null),
  ]);

  const [depositQr, balanceQr] = await Promise.all([
    depositTx && checkoutKind(depositTx) === "qr"
      ? qrSvg(depositTx.qr_payload)
      : Promise.resolve(null),
    balanceTx && checkoutKind(balanceTx) === "qr"
      ? qrSvg(balanceTx.qr_payload)
      : Promise.resolve(null),
  ]);

  const canCreateBalanceCheckout =
    booking.status !== "cancelled" &&
    Boolean(booking.deposit_transaction_id) &&
    !booking.balance_transaction_id;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {booking.customer_name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Event on {formatDate(booking.event_date)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <BookingStatusBadge status={booking.status} />
            <PrintBookingButton />
          </div>
          <BalanceDueIndicator booking={booking} />
        </div>
      </div>

      <div className="rounded-xl border p-4 text-sm">
        <dl className="grid grid-cols-2 gap-y-2">
          <dt className="text-muted-foreground">Booking ID</dt>
          <dd className="flex items-center gap-2">
            <code
              className="truncate font-mono text-xs text-muted-foreground"
              title={booking.id}
            >
              {booking.id}
            </code>
            <CopyBookingIdButton bookingId={booking.id} />
          </dd>
          <dt className="text-muted-foreground">Customer phone</dt>
          <dd>{booking.customer_phone ?? "—"}</dd>
          <dt className="text-muted-foreground">Total</dt>
          <dd>{formatCents(booking.total_amount_cents)}</dd>
          <dt className="text-muted-foreground">Deposit</dt>
          <dd>{formatCents(booking.deposit_amount_cents)}</dd>
          <dt className="text-muted-foreground">Balance</dt>
          <dd>{formatCents(booking.balance_amount_cents)}</dd>
          <dt className="text-muted-foreground">Balance due</dt>
          <dd>{formatDate(booking.balance_due_date)}</dd>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Paste the Booking ID above into a qkit event booth&rsquo;s settings to
          show this booking&rsquo;s live deposit/balance status there.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TransactionStatusCard
          label="Deposit"
          transaction={depositTx}
          qrMarkup={depositQr}
        />
        <TransactionStatusCard
          label="Balance"
          transaction={balanceTx}
          qrMarkup={balanceQr}
        />
      </div>

      {booking.status !== "cancelled" && (
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          {!booking.deposit_transaction_id && (
            <RecoverDepositButton bookingId={booking.id} />
          )}
          {canCreateBalanceCheckout && (
            <CreateBalanceCheckoutButton bookingId={booking.id} />
          )}
          <RescheduleBookingDialog
            bookingId={booking.id}
            eventDate={booking.event_date}
            balanceDueDate={booking.balance_due_date}
          />
          <CancelBookingDialog
            bookingId={booking.id}
            depositTx={depositTx}
            balanceTx={balanceTx}
          />
        </div>
      )}
    </div>
  );
}
