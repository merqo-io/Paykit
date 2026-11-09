import { after } from "next/server";
import { postKitCallback } from "@merqo/ui/kit-api";
import { createServiceClient } from "@/lib/supabase/server";
import { paymentStatusCallbackSchema } from "@/lib/api-schemas";
import { recordOpsEvent } from "@/lib/ops-events";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

export type CallbackTransaction = {
  id: string;
  vendor_id: string;
  kit_slug: string;
  order_ref: string;
  status: string;
};

/**
 * Tells the kit that owns a transaction that its status changed. The target
 * is the transaction's own `kit_slug`, not whichever kit made the request, so
 * a change paykit makes by itself reaches the right kit too.
 *
 * Best effort: a kit with no callback configured is skipped silently, every
 * failure is logged and swallowed, and the request is abandoned 5 seconds
 * after it is sent. A request that was sent and failed is also recorded in
 * `ops_events` for Merqo. The receiver treats the body as a hint and reads the status back,
 * so a lost or repeated call can never leave it holding a wrong status.
 */
export async function notifyKitPaymentStatus(
  tx: CallbackTransaction,
): Promise<void> {
  const body = paymentStatusCallbackSchema.safeParse({
    order_ref: tx.order_ref,
    transaction_id: tx.id,
    status: tx.status,
  });
  if (!body.success) {
    console.error("notifyKitPaymentStatus: transaction is not sendable", tx.id);
    return;
  }

  const recordFailure = (supabase: ServiceClient, code: string) =>
    recordOpsEvent(supabase, {
      vendorId: tx.vendor_id,
      kind: "payment_callback_failed",
      ref: tx.id,
      code,
    });
  try {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from("kit_api_keys")
      .select("callback_url, callback_secret")
      .eq("kit_slug", tx.kit_slug)
      .maybeSingle();
    if (error) {
      console.error(
        "notifyKitPaymentStatus: kit_api_keys lookup failed",
        error.message,
      );
      return;
    }
    if (!data?.callback_url && !data?.callback_secret) return;
    if (!data.callback_url || !data.callback_secret) {
      console.error(
        `notifyKitPaymentStatus: ${tx.kit_slug} has only one of callback_url and callback_secret set`,
      );
      return;
    }

    const result = await postKitCallback(
      { url: data.callback_url, secret: data.callback_secret },
      body.data,
    );
    if (result.ok) return;
    if (result.reason === "invalid_url") {
      console.error(
        `notifyKitPaymentStatus: ${tx.kit_slug} has an invalid callback_url (transaction ${tx.id})`,
      );
      return;
    }
    await recordFailure(
      supabase,
      result.reason === "http_error" ? `http_${result.status}` : result.reason,
    );
  } catch (err) {
    console.error(
      "notifyKitPaymentStatus failed",
      err instanceof Error ? err.name : "unknown error",
    );
  }
}

/**
 * Sends the callback once the response has gone out. `after` keeps the
 * function alive for it, which a detached promise does not guarantee on a
 * serverless host. The route must not await it: the receiving kit calls
 * paykit back from inside its handler.
 */
export function schedulePaymentStatusCallback(tx: CallbackTransaction): void {
  try {
    after(() => notifyKitPaymentStatus(tx));
  } catch {
    // `after` throws where there is no request to outlive. The transition
    // has already committed, so the route must still answer with it.
    console.error("schedulePaymentStatusCallback: could not schedule", tx.id);
  }
}
