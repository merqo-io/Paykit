import { rateLimit } from "@/lib/rate-limit";
import {
  conditionalTransition,
  noBody,
  runTransition,
} from "@/lib/payment-transition";
import { confirmTransition } from "@/lib/tx-state";

const apply = conditionalTransition({
  transition: confirmTransition,
  from: ["pending", "claimed"],
  patch: (status) => ({ status, confirmed_at: new Date().toISOString() }),
  audit: "confirmed",
});

export function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return runTransition(request, params, {
    action: "confirm",
    limiter: rateLimit,
    readBody: noBody,
    apply,
  });
}
