import type { Metadata } from "next";
import { getVendorSession } from "@/lib/vendor-session";
import { listAllTransactions } from "@/lib/transactions";
import { aggregateRevenueByDay } from "@/lib/revenue-report";
import { RevenueChart } from "./revenue-chart";

export const metadata: Metadata = {
  title: "Stats",
};

export default async function StatsPage() {
  const { user } = await getVendorSession();

  const transactions = await listAllTransactions(user.id);
  const data = aggregateRevenueByDay(transactions);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Stats</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Confirmed revenue by day, aggregated across every kit.
      </p>
      <div className="mt-6">
        <RevenueChart data={data} />
      </div>
    </div>
  );
}
