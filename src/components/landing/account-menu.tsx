"use client";

import Link from "next/link";
import { AccountMenu, getSwitchKits } from "@merqo/ui";
import { signOutAction } from "@/app/actions/auth";
import { submitFeedbackAction } from "@/app/actions/feedback";
import { submitSupportMessageAction } from "@/app/actions/support";
import { SUPPORT_CATEGORY_LABELS } from "@/lib/schemas";
import type { SupportMessageInput } from "@/lib/schemas";

type Category = SupportMessageInput["category"];

const HELP_CATEGORIES = Object.entries(SUPPORT_CATEGORY_LABELS).map(
  ([value, label]) => ({ value: value as Category, label }),
);

function isCategory(value: string | undefined): value is Category {
  return HELP_CATEGORIES.some((c) => c.value === value);
}

/**
 * Account dropdown for the public nav. The handlers are closures, which can't
 * cross the server/client boundary, so this client wrapper owns them while the
 * nav itself stays a Server Component.
 */
export function LandingAccountMenu({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string;
}) {
  return (
    <AccountMenu
      vendor={{ name, avatarUrl, subtitle: name }}
      signOutAction={signOutAction}
      LinkComponent={Link}
      switchKits={getSwitchKits("paykit")}
      getHelp={{
        type: "form",
        categories: HELP_CATEGORIES,
        onSubmit: async ({ message, category }) => {
          const res = await submitSupportMessageAction({
            category: isCategory(category) ? category : "other",
            body: message,
          });
          if (!res.success) throw new Error(res.error);
        },
      }}
      onFeedbackSubmit={async ({ message, nps }) => {
        const res = await submitFeedbackAction({
          nps: nps ?? 0,
          message: message.trim() || undefined,
        });
        if (!res.success) throw new Error(res.error);
      }}
      feedbackSource="vendor"
      feedbackMetric="nps"
      showNps
    />
  );
}
