"use server";

import { revalidatePath } from "next/cache";
import { dollarsToCents } from "@/lib/money";
import { getVendorSession } from "@/lib/vendor-session";
import { createServiceClient } from "@/lib/supabase/server";
import { createCheckout } from "@/lib/checkout";
import {
  createBookingInputSchema,
  cancelBookingInputSchema,
  createBalanceCheckoutInputSchema,
  rescheduleBookingInputSchema,
} from "@/lib/schemas";
import { recordAudit } from "@/lib/admin-audit";
import { linkInquiryToBooking } from "@/lib/inquiry-link";
import { inquiryStatusUpdateSchema } from "@/lib/inquiry-schemas";

export type BookingActionState = {
  status: "idle" | "ok" | "error";
  message?: string;
};

const KIT_SLUG = "paykit";

export async function createBookingAction(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const { supabase, user } = await getVendorSession();

  const parsed = createBookingInputSchema.safeParse({
    customer_name: formData.get("customer_name") ?? "",
    customer_phone: formData.get("customer_phone") ?? "",
    event_date: formData.get("event_date") ?? "",
    balance_due_date: formData.get("balance_due_date") ?? "",
    total_amount_cents: dollarsToCents(formData.get("total_amount")),
    deposit_amount_cents: dollarsToCents(formData.get("deposit_amount")),
    balance_amount_cents: dollarsToCents(formData.get("balance_amount")),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { data: booking, error: insertError } = await supabase
    .from("bookings")
    .insert({
      vendor_id: user.id,
      customer_name: parsed.data.customer_name,
      customer_phone: parsed.data.customer_phone || null,
      event_date: parsed.data.event_date,
      total_amount_cents: parsed.data.total_amount_cents,
      deposit_amount_cents: parsed.data.deposit_amount_cents,
      balance_amount_cents: parsed.data.balance_amount_cents,
      balance_due_date: parsed.data.balance_due_date,
    })
    .select("id")
    .single();
  if (insertError || !booking) {
    console.error("createBookingAction: insert failed", insertError?.message);
    return { status: "error", message: "Could not create booking. Try again." };
  }

  const inquiryId = inquiryStatusUpdateSchema.shape.inquiry_id.safeParse(
    formData.get("inquiry_id"),
  );
  if (inquiryId.success) {
    try {
      await linkInquiryToBooking(user.id, inquiryId.data, booking.id);
    } catch {
      console.error("createBookingAction: inquiry link unavailable");
    }
    revalidatePath(`/dashboard/bookings/inquiries/${inquiryId.data}`);
  }

  const recovery: BookingActionState = {
    status: "ok",
    message: "Booking saved. Open it and retry the deposit checkout.",
  };
  try {
    const checkout = await createCheckout({
      vendorId: user.id,
      kitSlug: KIT_SLUG,
      orderRef: `booking:${booking.id}:deposit`,
      amountCents: parsed.data.deposit_amount_cents,
    });
    if (!checkout.ok) {
      revalidatePath("/dashboard/bookings");
      return recovery;
    }
    const service = await createServiceClient();
    const { data: linked, error: linkError } = await service.rpc(
      "link_booking_deposit",
      {
        p_booking_id: booking.id,
        p_vendor_id: user.id,
        p_transaction_id: checkout.transaction_id,
      },
    );
    if (linkError || !linked) {
      revalidatePath("/dashboard/bookings");
      return recovery;
    }
  } catch {
    console.error("createBookingAction: deposit checkout unavailable");
    revalidatePath("/dashboard/bookings");
    return recovery;
  }

  try {
    await recordAudit(user.id, "create_booking", booking.id, {
      event_date: parsed.data.event_date,
      total_amount_cents: parsed.data.total_amount_cents,
      deposit_amount_cents: parsed.data.deposit_amount_cents,
      balance_amount_cents: parsed.data.balance_amount_cents,
    });
  } catch {
    console.error("createBookingAction: audit unavailable");
  }

  revalidatePath("/dashboard/bookings");
  return { status: "ok" };
}

export async function createBalanceCheckoutAction(
  bookingId: string,
): Promise<BookingActionState> {
  const { supabase, user } = await getVendorSession();

  const parsed = createBalanceCheckoutInputSchema.safeParse({
    booking_id: bookingId,
  });
  if (!parsed.success) {
    return { status: "error", message: "Invalid booking" };
  }

  const { data: booking, error: readError } = await supabase
    .from("bookings")
    .select(
      "id, status, balance_amount_cents, deposit_transaction_id, balance_transaction_id",
    )
    .eq("id", parsed.data.booking_id)
    .maybeSingle();
  if (readError || !booking) {
    return { status: "error", message: "Booking not found" };
  }
  if (booking.status === "cancelled") {
    return {
      status: "error",
      message: "Cannot create checkout for a cancelled booking.",
    };
  }
  if (!booking.deposit_transaction_id) {
    return {
      status: "error",
      message: "Create the deposit checkout before the balance checkout.",
    };
  }
  if (booking.balance_transaction_id) {
    return { status: "error", message: "Balance checkout already created." };
  }

  try {
    const checkout = await createCheckout({
      vendorId: user.id,
      kitSlug: KIT_SLUG,
      orderRef: `booking:${booking.id}:balance`,
      amountCents: booking.balance_amount_cents,
    });
    if (!checkout.ok) {
      return {
        status: "error",
        message: "Could not create the balance checkout. Try again.",
      };
    }
    const service = await createServiceClient();
    const { data: linked, error } = await service.rpc("link_booking_balance", {
      p_booking_id: booking.id,
      p_vendor_id: user.id,
      p_transaction_id: checkout.transaction_id,
    });
    if (error || !linked) {
      return {
        status: "error",
        message: "Could not link the balance checkout. Try again.",
      };
    }
  } catch {
    console.error("createBalanceCheckoutAction: checkout unavailable");
    return {
      status: "error",
      message: "Could not prepare the balance checkout. Try again.",
    };
  }
  try {
    await recordAudit(user.id, "create_balance_checkout", booking.id, {
      amount_cents: booking.balance_amount_cents,
    });
  } catch {
    console.error("createBalanceCheckoutAction: audit unavailable");
  }

  revalidatePath(`/dashboard/bookings/${booking.id}`);
  revalidatePath("/dashboard/bookings");
  return { status: "ok" };
}

// A booking a vendor cancels or reschedules may have had its deposit (or,
// rarer, its balance) already confirmed — this refunds that specific
// transaction, reusing `refunds`' own Pro/confirmed/ownership `with check`
// (see `issueRefundAction`) rather than a second enforcement path.
type BookingRefund = { transactionId: string; amountCents: number };

export async function cancelBookingAction(
  bookingId: string,
  reason?: string,
  refund?: BookingRefund,
): Promise<BookingActionState> {
  const { supabase, user } = await getVendorSession();

  const parsed = cancelBookingInputSchema.safeParse({
    booking_id: bookingId,
    reason: reason ?? "",
    refund_transaction_id: refund?.transactionId,
    refund_amount_cents: refund?.amountCents,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  // Read-then-write under RLS: an UPDATE on a booking that RLS filters out
  // (not this vendor's, or doesn't exist) returns `error: null` with zero
  // rows affected, not an error — a `.maybeSingle()` read first turns a
  // silent no-op into a real "not found", so a forged/stale id can't reach
  // `recordAudit` claiming a cancellation that never happened.
  const { data: booking, error: readError } = await supabase
    .from("bookings")
    .select("id, status, deposit_transaction_id, balance_transaction_id")
    .eq("id", parsed.data.booking_id)
    .maybeSingle();
  if (readError || !booking) {
    return { status: "error", message: "Booking not found" };
  }
  if (booking.status === "cancelled") {
    return { status: "ok" };
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", parsed.data.booking_id);
  if (updateError) {
    console.error("cancelBookingAction failed", updateError.message);
    return { status: "error", message: "Could not cancel booking." };
  }

  let refundRecorded: boolean | null = null;
  if (parsed.data.refund_transaction_id && parsed.data.refund_amount_cents) {
    const { error: refundError } = await supabase.from("refunds").insert({
      transaction_id: parsed.data.refund_transaction_id,
      refunded_amount_cents: parsed.data.refund_amount_cents,
      reason: parsed.data.reason || null,
      created_by: user.id,
    });
    refundRecorded = !refundError;
    if (refundError) {
      console.error(
        "cancelBookingAction: refund insert failed",
        refundError.message,
      );
    }
  }

  await recordAudit(user.id, "cancel_booking", parsed.data.booking_id, {
    reason: parsed.data.reason || null,
    refund_transaction_id: parsed.data.refund_transaction_id ?? null,
    refund_amount_cents: parsed.data.refund_amount_cents ?? null,
    refund_recorded: refundRecorded,
  });

  revalidatePath(`/dashboard/bookings/${parsed.data.booking_id}`);
  revalidatePath("/dashboard/bookings");
  return refundRecorded === false
    ? {
        status: "ok",
        message:
          "Booking cancelled, but the refund could not be recorded — check the transaction is confirmed and you're on Pro.",
      }
    : { status: "ok" };
}

export async function rescheduleBookingAction(
  bookingId: string,
  eventDate: string,
  balanceDueDate: string,
): Promise<BookingActionState> {
  const { supabase, user } = await getVendorSession();

  const parsed = rescheduleBookingInputSchema.safeParse({
    booking_id: bookingId,
    event_date: eventDate,
    balance_due_date: balanceDueDate,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { data: booking, error: readError } = await supabase
    .from("bookings")
    .select("id, status, event_date, balance_due_date")
    .eq("id", parsed.data.booking_id)
    .maybeSingle();
  if (readError || !booking) {
    return { status: "error", message: "Booking not found" };
  }
  if (booking.status === "cancelled") {
    return {
      status: "error",
      message: "Cannot reschedule a cancelled booking.",
    };
  }

  // No new `status` value for "rescheduled" — the booking stays whatever
  // payment state it's already in (deposit already paid keeps counting),
  // avoiding a conflict with `sync_booking_status()`'s trigger, which only
  // knows about the deposit/balance/cancelled states.
  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      event_date: parsed.data.event_date,
      balance_due_date: parsed.data.balance_due_date,
    })
    .eq("id", parsed.data.booking_id);
  if (updateError) {
    console.error("rescheduleBookingAction failed", updateError.message);
    return { status: "error", message: "Could not reschedule booking." };
  }

  await recordAudit(user.id, "reschedule_booking", parsed.data.booking_id, {
    previous_event_date: booking.event_date,
    previous_balance_due_date: booking.balance_due_date,
    new_event_date: parsed.data.event_date,
    new_balance_due_date: parsed.data.balance_due_date,
  });

  revalidatePath(`/dashboard/bookings/${parsed.data.booking_id}`);
  revalidatePath("/dashboard/bookings");
  return { status: "ok" };
}
