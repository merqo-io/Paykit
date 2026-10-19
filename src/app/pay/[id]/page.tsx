import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { hostedPayAllowed, loadHostedPayment } from "@/lib/hosted-pay";
import { clientIp } from "@/lib/rate-limit";
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

function Notice({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="mx-auto max-w-sm space-y-3 px-5 py-10 text-center">
      <h1 className="font-display text-2xl font-semibold text-balance">
        {title}
      </h1>
      <p className="text-sm text-muted-foreground">{detail}</p>
    </main>
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
  if (typeof k !== "string") notFound();

  const supabase = await createServiceClient();
  const ip = clientIp(await headers());
  if (!(await hostedPayAllowed(supabase, "view", ip, k)))
    return (
      <Notice
        title="Too many tries"
        detail="Wait a minute, then refresh this page."
      />
    );

  const read = await loadHostedPayment(supabase, id, k);
  if (!read.ok) {
    if (read.reason === "not_found") notFound();
    return (
      <Notice
        title="Couldn't load payment right now"
        detail="Refresh this page in a moment. Do not pay again if you already have."
      />
    );
  }

  const { payment } = read;
  if (payment.status !== "pending") {
    if (payment.returnUrl) redirect(payment.returnUrl);
    return (
      <Notice
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
        amountCents={payment.amountCents}
        view={payment.view}
      />
    </main>
  );
}
