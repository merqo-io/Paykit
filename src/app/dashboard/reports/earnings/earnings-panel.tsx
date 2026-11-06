import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { EmptyState } from "@merqo/ui";
import type { EarningsReport } from "@/lib/earnings-report";
import { formatCents } from "@/lib/utils";
import { reportsHref } from "../search-params";
import { DownloadCsvButton } from "./download-csv-button";
import { EarningsMonthsTable, EarningsLinesTable } from "./earnings-tables";

const ARROW_CLASS =
  "inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function EarningsPanel({
  report,
  year,
}: {
  report: EarningsReport;
  year: number;
}) {
  const isEmpty = report.total_revenue_cents === 0 && report.lines.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          <Link
            href={reportsHref("earnings", year - 1)}
            aria-label="Previous year"
            className={ARROW_CLASS}
          >
            <ChevronLeft aria-hidden className="size-4" />
          </Link>
          <span className="min-w-12 text-center text-sm font-semibold">
            {year}
          </span>
          <Link
            href={reportsHref("earnings", year + 1)}
            aria-label="Next year"
            className={ARROW_CLASS}
          >
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </div>
        <DownloadCsvButton report={report} />
      </div>

      <p className="text-sm text-muted-foreground">
        Revenue from confirmed payments, grouped by event date. Use it as a
        record for your own bookkeeping, not as a profit figure or a tax filing.
      </p>

      {isEmpty ? (
        <EmptyState
          title={`No earnings in ${year}`}
          description="Confirmed payments for this year show up here, by month and by booking."
        />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
