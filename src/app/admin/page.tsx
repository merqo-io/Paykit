import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin";
import {
  platformTotals,
  recentActivity,
  getAdminPricing,
  securityStats,
} from "@/lib/admin-data";
import { Stat } from "@/app/admin/stat";
import { Badge } from "@/components/ui/badge";
import { ElevatedCard } from "@merqo/ui";
import { formatCents, pctChange } from "@/lib/utils";
import { PricingSection } from "./pricing-section";

export const metadata: Metadata = {
  title: "Admin overview",
};

export const revalidate = 0;

export default async function AdminOverviewPage() {
  await requireAdmin();

  const [totals, activity, pricing, security] = await Promise.all([
    platformTotals(),
    recentActivity(15),
    getAdminPricing(),
    securityStats(),
  ]);

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-5 py-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Internal
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Overview</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Vendors" value={totals.vendors} />
        <Stat label="Free plan" value={totals.free_vendors} />
        <Stat label="Pro plan" value={totals.pro_vendors} />
        <Stat label="Transactions" value={totals.transactions} />
        <Stat
          label="Confirmed · 7d"
          value={totals.confirmed_7d}
          delta={pctChange(totals.confirmed_7d, totals.confirmed_prev_7d)}
          deltaTooltip="vs. the prior 7 days"
        />
        <Stat
          label="Confirmed volume · 30d"
          value={formatCents(totals.confirmed_volume_cents_30d)}
          delta={pctChange(
            totals.confirmed_volume_cents_30d,
            totals.confirmed_volume_cents_prev_30d,
          )}
          deltaTooltip="vs. the prior 30 days"
        />
        <Stat
          label="Refunds · 30d"
          value={totals.refund_count_30d}
          caption={formatCents(totals.refund_volume_cents_30d)}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Security
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Failed auth · 24h" value={security.failed_auth_24h} />
          <Stat
            label="Rate-limited kits · 24h"
            value={security.rate_limited_kits_24h}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Recent activity across all vendors
        </h2>
        <ElevatedCard className="p-6">
          <ul className="space-y-2.5">
            {activity.length > 0 ? (
              activity.map((tx) => (
                <li
                  key={tx.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="min-w-0 truncate font-medium">
                      {tx.email ?? "—"}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {tx.kit_slug}
                    </span>
                    <Badge
                      variant={
                        tx.status === "confirmed" ? "default" : "secondary"
                      }
                    >
                      {tx.status}
                    </Badge>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="tabular-nums">
                      {formatCents(tx.amount_cents)}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(tx.created_at).toLocaleString("en-SG")}
                    </span>
                  </span>
                </li>
              ))
            ) : (
              <li className="text-sm text-muted-foreground">
                No activity yet.
              </li>
            )}
          </ul>
        </ElevatedCard>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Pricing
        </h2>
        <PricingSection initial={pricing} />
      </section>
    </main>
  );
}
