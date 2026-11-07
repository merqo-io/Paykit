import { NextResponse } from "next/server";
import { toStatusResponse } from "@/lib/api-schemas";
import { claimTransaction } from "@/lib/claim";
import { runTransition } from "@/lib/payment-transition";
import { readProofFromRequest } from "@/lib/proof-file";
import { rateLimitStrict } from "@/lib/rate-limit";

export function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return runTransition(request, params, {
    action: "claim",
    limiter: rateLimitStrict,
    readBody: async (req) => {
      const read = await readProofFromRequest(req);
      return read.ok ? { ok: true, body: read.proof } : read;
    },
    apply: async ({ supabase, kitSlug, current, body }) => {
      const outcome = await claimTransaction(supabase, current, body, {
        kitSlug,
        scopedKitSlug: kitSlug,
      });
      if (!outcome.ok)
        return NextResponse.json(
          { error: outcome.error },
          { status: outcome.status },
        );
      return NextResponse.json(toStatusResponse(outcome.row));
    },
  });
}
