"use server";

import { submitFeedbackAction } from "@/app/actions/feedback";
import { submitSupportMessageAction } from "@/app/actions/support";
import type { SupportMessageInput } from "@/lib/schemas";
import type { ActionResult } from "@merqo/ui/kit-api";

/**
 * Adapters from the field names LandingAccountNav sends to the ones paykit's
 * own support and feedback actions validate. They live in a "use server"
 * module because closures cannot be passed from a Server Component to the
 * shared client nav.
 */
export async function submitLandingSupport(input: {
  category: SupportMessageInput["category"];
  message: string;
}): Promise<ActionResult> {
  return submitSupportMessageAction({
    category: input.category,
    body: input.message,
  });
}

export async function submitLandingFeedback(input: {
  source: "vendor";
  nps: number;
  message?: string;
}): Promise<ActionResult> {
  return submitFeedbackAction({
    nps: input.nps,
    message: input.message?.trim() || undefined,
  });
}
