import type { ReactNode } from "react";
import type { Metadata } from "next";
import { EmptyState, PageHeader, ProLock } from "@merqo/ui";
import { getVendorSession } from "@/lib/vendor-session";
import { readVendorPlan } from "@/lib/vendor-entitlement";
import {
  freeRevenueWindow,
  isPaidPlan,
  sumFreeRevenue,
} from "@/lib/free-limits";
import { listAllTransactions, listConfirmedBetween } from "@/lib/transactions";
import { listAllBookings } from "@/lib/bookings";
import { buildEarningsReport } from "@/lib/earnings-report";
import { aggregateRevenueByDay } from "@/lib/revenue-report";
import { RevenueChart } from "../stats/revenue-chart";
import { FreeRevenueSummary } from "./free-revenue-summary";
import { EarningsPanel } from "./earnings/earnings-panel";
import { ReportsTabs } from "./reports-tabs";
import { parseReportsParams } from "./search-params";

export const metadata: Metadata = {
  title: "Reports",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, user } = await getVendorSession();
  const { tab, year } = parseReportsParams(await searchParams);
  const isPaid = isPaidPlan(await readVendorPlan(supabase, user.id));

  // Only the active tab's data is fetched, and Free never loads beyond today and yesterday.
  let content: ReactNode;
  if (!isPaid) {
    if (tab === "overview") {
      const { startIso, endIso } = freeRevenueWindow();
      const totals = sumFreeRevenue(
        await listConfirmedBetween(user.id, startIso, endIso),
      );
      content = <FreeRevenueSummary {...totals} />;
    } else {
      content = (
        <ProLock
          label="See which days and hours bring in the most, and export to CSV for your accountant. Included with Starter and Pro"
          href="/dashboard/plan"
        />
      );
    }
  } else if (tab === "overview") {
    const data = aggregateRevenueByDay(await listAllTransactions(user.id));
    content =
      data.length === 0 ? (
        <EmptyState
          title="No revenue yet"
          description="Confirmed payments show up here as revenue by day."
        />
      ) : (
        <RevenueChart data={data} />
      );
  } else {
    const [transactions, bookings] = await Promise.all([
      listAllTransactions(user.id),
      listAllBookings(user.id),
    ]);
    content = (
      <EarningsPanel
        report={buildEarningsReport(transactions, bookings, year)}
        year={year}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        responsive
        title="Reports"
        description="Revenue from confirmed payments across every kit."
      />
      <ReportsTabs active={tab} />
      {content}
    </div>
  );
}
