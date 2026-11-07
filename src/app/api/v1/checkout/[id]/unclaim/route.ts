import { rateLimit } from "@/lib/rate-limit";
import {
  conditionalTransition,
  noBody,
  runTransition,
} from "@/lib/payment-transition";
import { unclaimTransition } from "@/lib/tx-state";

const apply = conditionalTransition({
  transition: unclaimTransition,
  from: ["claimed"],
  patch: (status) => ({ status, claimed_at: null }),
  audit: "unclaimed",
});

export function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return runTransition(request, params, {
    action: "unclaim",
    limiter: rateLimit,
    readBody: noBody,
    apply,
  });
}
