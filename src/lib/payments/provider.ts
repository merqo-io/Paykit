//
// Payment-provider seam: paykit's own EMVCo/pointer builder (renderCheckout)
// is the default ("direct") provider. Swapping in a real gateway later —
// for genuine tap-to-open-bank-app, see the design spec — is a
// PAYKIT_PROVIDER config change plus one more implementation of
// PaymentProvider, with no changes to callers, CheckoutView, or the
// checkout HTTP contract. See
// docs/superpowers/specs/2026-08-13-paynow-tap-to-pay-design.md (qkit repo).

import { renderCheckout } from "./adapter";
import type { CheckoutView } from "./adapter";
import type { TxStatus, VendorPaymentConfig } from "@/lib/types";

type ProviderCheckoutStatus = { status: TxStatus } | null;

export interface PaymentProvider {
  name: string;
  createCheckout(
    config: VendorPaymentConfig,
    ctx: { amountCents: number; orderRef: string },
  ): CheckoutView | null | Promise<CheckoutView | null>;
  getStatus(transactionId: string): Promise<ProviderCheckoutStatus>;
}

export const directProvider: PaymentProvider = {
  name: "direct",
  createCheckout: renderCheckout,
  // paykit's own `transactions` table is authoritative for this provider —
  // there's no external gateway state to reconcile against.
  async getStatus() {
    return null;
  },
};

const PROVIDERS: Record<string, PaymentProvider> = {
  direct: directProvider,
};

/**
 * Selects the active provider from `PAYKIT_PROVIDER`. Unset or
 * unrecognized falls back to `direct` with a warning — never breaks
 * checkout over a bad config value.
 */
export function getProvider(): PaymentProvider {
  const name = process.env.PAYKIT_PROVIDER;
  if (!name) return directProvider;
  const provider = Object.hasOwn(PROVIDERS, name) ? PROVIDERS[name] : undefined;
  if (!provider) {
    console.warn(`paykit: unknown PAYKIT_PROVIDER "${name}", using "direct"`);
    return directProvider;
  }
  return provider;
}
