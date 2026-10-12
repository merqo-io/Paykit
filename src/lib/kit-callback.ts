import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { paymentStatusCallbackSchema } from "@/lib/api-schemas";

const CALLBACK_TIMEOUT_MS = 5000;

export type CallbackTransaction = {
  id: string;
  kit_slug: string;
  order_ref: string;
  status: string;
};

// The secret travels in a header, so anything but https would expose it.
function httpsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/**
 * Tells the kit that owns a transaction that its status changed. The target
 * is the transaction's own `kit_slug`, not whichever kit made the request, so
 * a change paykit makes by itself reaches the right kit too.
 *
 * Best effort: a kit with no callback configured is skipped silently, every
 * failure is logged and swallowed, and the request is abandoned after 5
 * seconds. The receiver treats the body as a hint and reads the status back,
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALLBACK_TIMEOUT_MS);
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
    if (!data?.callback_url || !data.callback_secret) return;

    const url = httpsUrl(data.callback_url);
    if (!url) {
      console.error(
        `notifyKitPaymentStatus: ${tx.kit_slug} callback_url is not an https URL`,
      );
      return;
    }

    const res = await fetch(url, {
      method: "POST",
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${data.callback_secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body.data),
    });
    if (!res.ok)
      console.error(
        `notifyKitPaymentStatus: ${tx.kit_slug} returned ${res.status}`,
      );
  } catch (err) {
    console.error(
      "notifyKitPaymentStatus failed",
      err instanceof Error ? err.message : "unknown error",
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Sends the callback once the response has gone out. `after` keeps the
 * function alive for it, which a detached promise does not guarantee on a
 * serverless host. The route must not await it: the receiving kit calls
 * paykit back from inside its handler.
 */
export function schedulePaymentStatusCallback(tx: CallbackTransaction): void {
  after(() => notifyKitPaymentStatus(tx));
}
