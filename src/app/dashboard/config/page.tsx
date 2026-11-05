import type { Metadata } from "next";
import { getVendorSession } from "@/lib/vendor-session";
import { familyReturnUrl } from "@/lib/return-to";
import { getConfig } from "./actions";
import { PageHeader } from "@/components/page-header";
import { PaymentConfigForm } from "./payment-config-form";

export const metadata: Metadata = {
  title: "Payment setup",
};

/**
 * Another Merqo app can send a vendor here with `return_to`, the page to go
 * back to once the payment details are saved. The value is the caller's to
 * choose, so only an address `familyReturnUrl` accepts reaches the form.
 */
export default async function ConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string | string[] }>;
}) {
  const { user } = await getVendorSession();
  const [config, { return_to }] = await Promise.all([
    getConfig(),
    searchParams,
  ]);
  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        eyebrow="Account"
        title="Payment setup"
        description="Set this up once. It's reused by every kit that uses paykit for you."
      />
      <PaymentConfigForm
        initial={config}
        vendorId={user.id}
        returnTo={familyReturnUrl(return_to)}
      />
    </div>
  );
}
