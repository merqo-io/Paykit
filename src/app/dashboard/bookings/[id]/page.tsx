import type { Metadata } from "next";
import { BookingIdCopy } from "./booking-id-copy";
import { checkoutKind } from "@/lib/checkout-kind";
import { RecoverDepositButton } from "./recover-deposit-button";
import { notFound } from "next/navigation";
import { Money, Timestamp, formatDate, qrSvg } from "@merqo/ui";
import { getVendorSession } from "@/lib/vendor-session";
import { getBooking } from "@/lib/bookings";
import { getTransaction } from "@/lib/transactions";
import { getInquiryForBooking } from "@/lib/inquiry-inbox";
import { readVendorPlan } from "@/lib/vendor-entitlement";
import { PageHeader } from "@merqo/ui";
import { BookingStatusBadge, BalanceDueIndicator } from "../booking-badges";
import { TermsSnapshot } from "../inquiry-badges";
import { CustomerPhone } from "../customer-phone";
import { TransactionStatusCard } from "./transaction-status-card";
import { CreateBalanceCheckoutButton } from "./create-balance-checkout-button";
import { CancelBookingDialog } from "./cancel-booking-dialog";
import { RescheduleBookingDialog } from "./reschedule-booking-dialog";
import { PrintBookingButton } from "./print-booking-button";

export const metadata: Metadata = {
  title: "Booking",
};

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await getVendorSession();
  const booking = await getBooking(user.id, id);
  if (!booking) notFound();

  const [depositTx, balanceTx, inquiry, plan] = await Promise.all([
    booking.deposit_transaction_id
      ? getTransaction(user.id, booking.deposit_transaction_id)
      : Promise.resolve(null),
    booking.balance_transaction_id
      ? getTransaction(user.id, booking.balance_transaction_id)
      : Promise.resolve(null),
    getInquiryForBooking(user.id, booking.id),
    readVendorPlan(supabase, user.id),
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
      <PageHeader
        responsive
        title={booking.customer_name}
        description={`Event on ${formatDate(booking.event_date)}`}
        className="mb-0"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <BookingStatusBadge status={booking.status} />
            <BalanceDueIndicator booking={booking} />
            <PrintBookingButton />
          </div>
        }
      />

      <section aria-labelledby="customer-heading">
        <h2 id="customer-heading" className="text-base font-semibold">
          Customer
        </h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Phone</dt>
          <dd>
            <CustomerPhone phone={booking.customer_phone} />
          </dd>
          {inquiry && (
            <>
              <dt className="text-muted-foreground">Booking terms</dt>
              <dd>
                <TermsSnapshot inquiry={inquiry} />
              </dd>
            </>
          )}
        </dl>
      </section>

      <section aria-labelledby="amounts-heading">
        <h2 id="amounts-heading" className="text-base font-semibold">
          Amounts
        </h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm tabular-nums">
          <dt className="text-muted-foreground">Total</dt>
          <dd>
            <Money cents={booking.total_amount_cents} />
          </dd>
          <dt className="text-muted-foreground">Deposit</dt>
          <dd>
            <Money cents={booking.deposit_amount_cents} />
          </dd>
          <dt className="text-muted-foreground">Balance</dt>
          <dd>
            <Money cents={booking.balance_amount_cents} />
          </dd>
          <dt className="text-muted-foreground">Balance due</dt>
          <dd>
            <Timestamp value={booking.balance_due_date} variant="date" />
          </dd>
        </dl>
      </section>

      <section aria-labelledby="reference-heading">
        <h2 id="reference-heading" className="text-base font-semibold">
          Booking ID
        </h2>
        <div className="mt-2 flex items-center gap-2 text-sm">
          <code
            className="min-w-0 truncate font-mono text-xs text-muted-foreground"
            title={booking.id}
          >
            {booking.id}
          </code>
          <BookingIdCopy bookingId={booking.id} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Paste this into your qkit event&rsquo;s payment settings to show this
          booking&rsquo;s live deposit and balance status there.
        </p>
      </section>

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
            isPro={plan !== "free"}
          />
        </div>
      )}
    </div>
  );
}
