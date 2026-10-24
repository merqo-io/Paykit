"use server";

import { revalidatePath } from "next/cache";
import { getVendorSession } from "@/lib/vendor-session";
// eslint-disable-next-line no-restricted-imports -- RLS has no client policy for this write; the caller is verified first
import { createServiceClient } from "@/lib/supabase/server";
import { createCheckout } from "@/lib/checkout";
import { createBalanceCheckoutInputSchema } from "@/lib/schemas";
import type { BookingActionState } from "./actions";

async function recoverDeposit(
  bookingId: string,
  userId: string,
  depositAmount: number,
): Promise<BookingActionState> {
  const service = await createServiceClient();
  const orderRef = "booking:" + bookingId + ":deposit";
  const { data: existing, error: lookupError } = await service
    .from("transactions")
    .select("id, amount_cents")
    .eq("vendor_id", userId)
    .eq("kit_slug", "paykit")
    .eq("order_ref", orderRef)
    .maybeSingle();
  if (lookupError || (existing && existing.amount_cents !== depositAmount)) {
    return {
      status: "error",
      message: "Could not verify the deposit checkout.",
    };
  }
  let transactionId = existing?.id;
  if (!transactionId) {
    const checkout = await createCheckout({
      vendorId: userId,
      kitSlug: "paykit",
      orderRef,
      amountCents: depositAmount,
    });
    if (!checkout.ok) {
      return {
        status: "error",
        message: "Could not create the deposit checkout. Try again.",
      };
    }
    transactionId = checkout.transaction_id;
  }
  const { data: linked, error: linkError } = await service.rpc(
    "link_booking_deposit",
    {
      p_booking_id: bookingId,
      p_vendor_id: userId,
      p_transaction_id: transactionId,
    },
  );
  if (linkError || !linked) {
    return {
      status: "error",
      message: "Could not link the deposit checkout. Refresh and try again.",
    };
  }
  revalidatePath("/dashboard/bookings/" + bookingId);
  revalidatePath("/dashboard/bookings");
  return { status: "ok" };
}

export async function recoverDepositCheckoutAction(
  bookingId: string,
): Promise<BookingActionState> {
  const parsed = createBalanceCheckoutInputSchema.safeParse({
    booking_id: bookingId,
  });
  if (!parsed.success) return { status: "error", message: "Invalid booking" };
  const { supabase, user } = await getVendorSession();
  try {
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("id, status, deposit_amount_cents, deposit_transaction_id")
      .eq("id", parsed.data.booking_id)
      .maybeSingle();
    if (error || !booking)
      return { status: "error", message: "Booking not found" };
    if (booking.status === "cancelled") {
      return {
        status: "error",
        message: "Cannot recover a cancelled booking.",
      };
    }
    if (booking.deposit_transaction_id) {
      revalidatePath("/dashboard/bookings/" + booking.id);
      revalidatePath("/dashboard/bookings");
      return { status: "ok" };
    }
    return await recoverDeposit(
      booking.id,
      user.id,
      booking.deposit_amount_cents,
    );
  } catch {
    console.error("recoverDepositCheckoutAction: checkout unavailable");
    return {
      status: "error",
      message: "Could not recover the deposit checkout. Please try again.",
    };
  }
}
