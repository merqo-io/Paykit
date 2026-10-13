import type { createServiceClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/api-schemas";
import { toLookupResponse } from "@/lib/checkout-lookup";
import { payTokenMatches, payTokenSchema } from "@/lib/pay-token";
import type { Transaction, TxStatus } from "@/lib/types";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

/**
 * Everything the hosted pay page may show or act on. It carries no vendor
 * id, order reference or kit name: the page is public, and the customer
 * needs none of them to pay.
 */
export type HostedPayment = {
  id: string;
  status: TxStatus;
  amountCents: number;
  title: string | null;
  returnUrl: string | null;
  view:
    | { type: "qr"; payload: string }
    | { type: "link"; url: string; label: string }
    | { type: "image"; url: string }
    | null;
};

export type HostedPaymentRead =
  | { ok: true; payment: HostedPayment; row: Transaction }
  | { ok: false; reason: "not_found" | "unavailable" };

const NOT_FOUND: HostedPaymentRead = { ok: false, reason: "not_found" };

// Compared against when a transaction has no token, so a miss costs the same
// hashing work as a wrong token for a transaction that has one.
const NO_TOKEN_HASH = "0".repeat(64);

/**
 * Reads one transaction for the hosted pay page, and only for the holder of
 * its pay token. The page has no session and no bearer secret: the token in
 * the customer's link is the whole authorization, so this is the one place
 * a transaction is read on a caller's say-so alone.
 *
 * `not_found` covers a malformed id or token, an id that does not exist, a
 * transaction that has no pay page, and a token that is not this
 * transaction's. A caller must answer all of them the same way, so nothing
 * can be learned about an id without its token. `unavailable` means the
 * database could not be read.
 *
 * `row` is for server code that goes on to act on the transaction. Only
 * `payment` may be sent to the browser.
 */
export async function loadHostedPayment(
  supabase: ServiceClient,
  id: string,
  token: string,
): Promise<HostedPaymentRead> {
  if (
    !uuidSchema.safeParse(id).success ||
    !payTokenSchema.safeParse(token).success
  )
    return NOT_FOUND;

  const { data: row, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("hosted pay: read failed", error.message);
    return { ok: false, reason: "unavailable" };
  }

  const storedHash = row?.pay_token_hash ?? null;
  const matches = payTokenMatches(token, storedHash ?? NO_TOKEN_HASH);
  if (!row || !storedHash || !matches) return NOT_FOUND;

  return {
    ok: true,
    row,
    payment: {
      id: row.id,
      status: row.status,
      amountCents: row.amount_cents,
      title: row.pay_title ?? null,
      returnUrl: row.return_url ?? null,
      view: toLookupResponse(row).view,
    },
  };
}
