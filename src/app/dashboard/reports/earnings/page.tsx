import type { Metadata } from "next";
import Link from "next/link";
import { getVendorSession } from "@/lib/vendor-session";
import { listAllTransactions } from "@/lib/transactions";
import { listAllBookings } from "@/lib/bookings";
import { buildEarningsReport } from "@/lib/earnings-report";
import { formatCents } from "@/lib/utils";
import { DownloadCsvButton } from "./download-csv-button";
import { EarningsMonthsTable, EarningsLinesTable } from "./earnings-tables";

export const metadata: Metadata = {
  title: "Earnings report",
};

function parseYear(raw: string | string[] | undefined): number {
  const currentYear = new Date().getUTCFullYear();
  const parsed = Number(Array.isArray(raw) ? raw[0] : raw);
  return Number.isInteger(parsed) && parsed > 2000 && parsed < 3000
    ? parsed
    : currentYear;
}

export default async function EarningsReportPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { user } = await getVendorSession();
  const { year: rawYear } = await searchParams;
  const year = parseYear(rawYear);

  const [transactions, bookings] = await Promise.all([
    listAllTransactions(user.id),
    listAllBookings(user.id),
  ]);
  const report = buildEarningsReport(transactions, bookings, year);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Earnings report
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Revenue from confirmed payments, tagged by event date — a record for
            your own bookkeeping, not a computed profit figure or a Form-B-ready
            submission.
          </p>
        </div>
        <DownloadCsvButton report={report} />
      </div>

      <div className="flex items-center justify-between">
        <Link
          href={`/dashboard/reports/earnings?year=${year - 1}`}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ← {year - 1}
        </Link>
        <span className="text-sm font-semibold">{year}</span>
        <Link
          href={`/dashboard/reports/earnings?year=${year + 1}`}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          {year + 1} →
        </Link>
      </div>

      <div className="rounded-xl border p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Total revenue
        </p>
        <p className="mt-1 text-2xl font-semibold">
          {formatCents(report.total_revenue_cents)}
        </p>
      </div>

      <div className="rounded-xl border">
        <EarningsMonthsTable months={report.months} />
      </div>

      {report.lines.length > 0 && (
        <div className="rounded-xl border">
          <EarningsLinesTable lines={report.lines} />
        </div>
      )}
    </div>
  );
}
