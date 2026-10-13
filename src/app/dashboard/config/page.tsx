import { getVendorSession } from "@/lib/vendor-session";
import { familyReturnUrl } from "@/lib/return-to";
import { getConfig } from "./actions";
import { PaymentConfigForm } from "./payment-config-form";

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
      <h1 className="text-2xl font-semibold tracking-tight">Payment setup</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Set this up once — it&apos;s reused by every kit that uses paykit for
        you.
      </p>
      <div className="mt-6">
        <PaymentConfigForm
          initial={config}
          vendorId={user.id}
          returnTo={familyReturnUrl(return_to)}
        />
      </div>
    </div>
  );
}
