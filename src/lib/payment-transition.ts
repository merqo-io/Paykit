import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { verifyKitAuth } from "@/lib/kit-auth";
import { toStatusResponse, uuidSchema } from "@/lib/api-schemas";
import {
  recordPaymentAudit,
  type PaymentAuditAction,
} from "@/lib/payment-audit";
import { schedulePaymentStatusCallback } from "@/lib/payment-status-callback";
import {
  clientIp,
  PER_ROUTE_LIMIT,
  PER_ROUTE_WINDOW_SECONDS,
} from "@/lib/rate-limit";
import { TRANSACTION_COLUMNS } from "@/lib/columns";
import type { TxStatus } from "@/lib/tx-state";
import type { Transaction } from "@/lib/types";

export type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

type Limiter = (
  supabase: ServiceClient,
  key: string,
  limit: number,
  windowSeconds: number,
) => Promise<boolean>;

export type BodyRead<B> =
  { ok: true; body: B } | { ok: false; error: string; status: number };

export type TransitionContext<B> = {
  supabase: ServiceClient;
  kitSlug: string;
  id: string;
  current: Transaction;
  body: B;
};

export type TransitionSpec<B> = {
  action: string;
  limiter: Limiter;
  readBody: (request: Request) => Promise<BodyRead<B>>;
  apply: (ctx: TransitionContext<B>) => Promise<Response>;
};

export const noBody = async (): Promise<BodyRead<undefined>> => ({
  ok: true,
  body: undefined,
});

const fail = (error: string, status: number) =>
  NextResponse.json({ error }, { status });

/** Auth, rate limit, id check, body read and scoped row read shared by every kit transition route. */
export async function runTransition<B>(
  request: Request,
  params: Promise<{ id: string }>,
  spec: TransitionSpec<B>,
): Promise<Response> {
  const auth = await verifyKitAuth(request);
  if (!auth) return fail("Unauthorized", 401);
  const { kitSlug } = auth;

  const supabase = await createServiceClient();
  const ip = clientIp(request.headers);
  const allowed = await spec.limiter(
    supabase,
    `${spec.action}:${kitSlug}:${ip}`,
    PER_ROUTE_LIMIT,
    PER_ROUTE_WINDOW_SECONDS,
  );
  if (!allowed) return fail("Too many requests", 429);

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success)
    return fail("Invalid transaction id", 400);

  const read = await spec.readBody(request);
  if (!read.ok) return fail(read.error, read.status);

  const { data: current, error: readError } = await supabase
    .from("transactions")
    .select(TRANSACTION_COLUMNS)
    .eq("id", id)
    .eq("kit_slug", kitSlug)
    .maybeSingle();
  if (readError) {
    console.error(`${spec.action}: read failed`, readError.message);
    return fail("Upstream unavailable", 503);
  }
  if (!current) return fail("Not found", 404);

  return spec.apply({ supabase, kitSlug, id, current, body: read.body });
}

type Patch = { status: TxStatus } & Partial<
  Pick<Transaction, "confirmed_at" | "claimed_at">
>;

/** Builds an `apply` that moves the row with a guarded update and re-reads it when a concurrent write wins. */
export function conditionalTransition(opts: {
  transition: (current: TxStatus) => { status: TxStatus; changed: boolean };
  from: readonly TxStatus[];
  patch: (next: TxStatus) => Patch;
  audit: PaymentAuditAction;
}): (ctx: TransitionContext<undefined>) => Promise<Response> {
  return async ({ supabase, kitSlug, id, current }) => {
    const { status, changed } = opts.transition(current.status as TxStatus);
    if (!changed) return NextResponse.json(toStatusResponse(current));

    const { data: updated, error: updateError } = await supabase
      .from("transactions")
      .update(opts.patch(status))
      .eq("id", id)
      .eq("kit_slug", kitSlug)
      .in("status", [...opts.from])
      .select(TRANSACTION_COLUMNS)
      .single();
    if (updateError || !updated) {
      const { data: recheck, error: recheckError } = await supabase
        .from("transactions")
        .select(TRANSACTION_COLUMNS)
        .eq("id", id)
        .eq("kit_slug", kitSlug)
        .maybeSingle();
      if (recheckError || (recheck && recheck.status === current.status))
        return fail("Upstream unavailable", 503);
      if (!recheck) return fail("Not found", 404);
      return NextResponse.json(toStatusResponse(recheck));
    }

    await recordPaymentAudit(supabase, {
      transactionId: id,
      kitSlug,
      action: opts.audit,
    });
    schedulePaymentStatusCallback(updated);
    return NextResponse.json(toStatusResponse(updated));
  };
}
