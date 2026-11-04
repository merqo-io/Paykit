import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
// eslint-disable-next-line no-restricted-imports -- anonymous customer flow; the pay token or public form id is the credential
import { createServiceClient } from "@/lib/supabase/server";
import {
  hostedPayAllowed,
  isWellFormedHostedRef,
  loadHostedPayment,
} from "@/lib/hosted-pay";
import { clientIp } from "@/lib/rate-limit";
import { Notice } from "./notice";
import { PayPanel } from "./pay-panel";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ k?: string | string[] }>;
}

export const dynamic = "force-dynamic";

// The link is a customer's own: keep it out of search results, and out of
// the Referer header of anything the page links to.
export const metadata: Metadata = {
  title: "Pay",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function PageNotice(props: { title: string; detail: string }) {
  return (
    <main>
      <Notice {...props} />
    </main>
  );
}

function RetryNotice() {
  return (
    <PageNotice
      title="Could not load payment"
      detail="Refresh this page in a moment. If you have already paid, do not pay again."
    />
  );
}

/**
 * The hosted pay page: where a calling kit sends its customer to pay. Public,
 * with no sign-in. The `k` token in the link is the whole authorization, so
 * a transaction id by itself opens nothing, and every way of not having the
 * right token gets the same 404.
 */
export default async function PayPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { k } = await searchParams;
  if (typeof k !== "string" || !isWellFormedHostedRef(id, k)) notFound();

  const supabase = await createServiceClient();
  const ip = clientIp(await headers());
  const access = await hostedPayAllowed(supabase, "view", ip, k);
  if (access === "limited")
    return (
      <PageNotice
        title="Too many tries"
        detail="Wait a minute, then refresh this page."
      />
    );
  if (access === "unavailable") return <RetryNotice />;

  const read = await loadHostedPayment(supabase, id, k);
  if (!read.ok) {
    if (read.reason === "not_found") notFound();
    return <RetryNotice />;
  }

  const { payment } = read;
  if (payment.status !== "pending") {
    if (payment.returnUrl) redirect(payment.returnUrl);
    return (
      <PageNotice
        title="Payment recorded"
        detail="The seller has been told. You can close this page."
      />
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col px-5 py-10">
      <PayPanel
        id={payment.id}
        token={k}
        title={payment.title}
        sellerName={payment.sellerName}
        amountCents={payment.amountCents}
        view={payment.view}
      />
    </main>
  );
}
