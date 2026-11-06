import type { ReactNode } from "react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { getVendorSession } from "@/lib/vendor-session";
import { listAllTransactions } from "@/lib/transactions";
import { listAllBookings } from "@/lib/bookings";
import { buildEarningsReport } from "@/lib/earnings-report";
import { aggregateRevenueByDay } from "@/lib/revenue-report";
import { RevenueChart } from "../stats/revenue-chart";
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
  const { user } = await getVendorSession();
  const { tab, year } = parseReportsParams(await searchParams);

  // Only the active tab's data is fetched.
  let content: ReactNode;
  if (tab === "overview") {
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
        eyebrow="Insights"
        title="Reports"
        description="Revenue from confirmed payments across every kit."
      />
      <ReportsTabs active={tab} />
      {content}
    </div>
  );
}
