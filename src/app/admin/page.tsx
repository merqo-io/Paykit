import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import {
  platformTotals,
  recentActivity,
  securityStats,
} from "@/lib/admin-data";
import { Badge } from "@merqo/ui/primitives";

import {
  EmptyState,
  Money,
  PageHeader,
  StatCard,
  Timestamp,
  formatMoney,
} from "@merqo/ui";
import type { TxStatus } from "@/lib/types";
import { listHref } from "@/app/admin/list-params";
import { pctChange } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Admin overview",
};

export const revalidate = 0;

// API status values are unchanged; only the displayed wording differs.
const STATUS_LABELS: Record<TxStatus, string> = {
  pending: "Awaiting payment",
  claimed: "Marked paid",
  confirmed: "Received",
};

export default async function AdminOverviewPage() {
  await requireAdmin();

  const [totals, activity, security] = await Promise.all([
    platformTotals(),
    recentActivity(15),
    securityStats(),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-5 py-8">
      <PageHeader responsive title="Overview" className="mb-0" />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard
          deltaSize="xs"
          label="Vendors"
          value={String(totals.vendors)}
        />
        <StatCard
          deltaSize="xs"
          label="Free plan"
          value={String(totals.free_vendors)}
        />
        <StatCard
          deltaSize="xs"
          label="Pro plan"
          value={String(totals.pro_vendors)}
        />
        <StatCard
          deltaSize="xs"
          label="Transactions"
          value={String(totals.transactions)}
        />
        <StatCard
          deltaSize="xs"
          label="Confirmed · 7d"
          value={String(totals.confirmed_7d)}
          delta={pctChange(totals.confirmed_7d, totals.confirmed_prev_7d)}
          deltaTooltip="vs. the prior 7 days"
        />
        <StatCard
          deltaSize="xs"
          label="Confirmed volume · 30d"
          value={formatMoney(totals.confirmed_volume_cents_30d)}
          delta={pctChange(
            totals.confirmed_volume_cents_30d,
            totals.confirmed_volume_cents_prev_30d,
          )}
          deltaTooltip="vs. the prior 30 days"
        />
        <StatCard
          deltaSize="xs"
          label="Refunds · 30d"
          value={String(totals.refund_count_30d)}
          caption={formatMoney(totals.refund_volume_cents_30d)}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Security</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard
            deltaSize="xs"
            label="Failed sign-ins, last 24h"
            value={String(security.failed_auth_24h)}
          />
          <StatCard
            deltaSize="xs"
            label="Rate-limited kits · 24h"
            value={String(security.rate_limited_kits_24h)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">
          Recent activity across all vendors
        </h2>
        {activity.length > 0 ? (
          <ul className="divide-y border-y">
            {activity.map((tx) => (
              <li key={tx.id}>
                <Link
                  href={listHref("/admin/vendors", { q: tx.vendor_id })}
                  className="flex min-h-11 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 text-sm hover:bg-muted/50"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="min-w-0 truncate font-medium">
                      {tx.email ?? "Not set"}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {tx.kit_slug}
                    </span>
                    <Badge
                      variant={
                        tx.status === "confirmed" ? "default" : "secondary"
                      }
                    >
                      {STATUS_LABELS[tx.status]}
                    </Badge>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <Money cents={tx.amount_cents} />
                    <Timestamp
                      value={tx.created_at}
                      variant="datetime"
                      className="text-muted-foreground"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No activity yet"
            description="Payments from every vendor show up here as they happen."
          />
        )}
      </section>
    </main>
  );
}
