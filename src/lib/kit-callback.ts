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

// The secret travels in a header, so anything but https would expose it. An
// address with credentials in it is refused too: fetch rejects one with an
// error that quotes the whole URL.
function httpsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url;
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
 * failure is logged and swallowed, and the request is abandoned 5 seconds
 * after it is sent. The receiver treats the body as a hint and reads the status back,
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
  let timer: ReturnType<typeof setTimeout> | undefined;
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

    const url = httpsUrl(data.callback_url);
    if (!url) {
      console.error(
        `notifyKitPaymentStatus: ${tx.kit_slug} callback_url is not a plain https URL`,
      );
      return;
    }

    timer = setTimeout(() => controller.abort(), CALLBACK_TIMEOUT_MS);
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
    // The name only. A fetch error's message can quote the Authorization
    // header or the URL it was given.
    console.error(
      "notifyKitPaymentStatus failed",
      err instanceof Error ? err.name : "unknown error",
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
  try {
    after(() => notifyKitPaymentStatus(tx));
  } catch {
    // `after` throws where there is no request to outlive. The transition
    // has already committed, so the route must still answer with it.
    console.error("schedulePaymentStatusCallback: could not schedule", tx.id);
  }
}
