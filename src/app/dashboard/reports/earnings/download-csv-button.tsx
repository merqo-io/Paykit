"use client";

import { downloadBlob } from "@merqo/ui";
import { Button } from "@merqo/ui/primitives";

import { earningsReportToCsv } from "@/lib/earnings-csv";
import type { EarningsReport } from "@/lib/earnings-report";

export function DownloadCsvButton({ report }: { report: EarningsReport }) {
  function onClick() {
    const csv = earningsReportToCsv(report);
    downloadBlob(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
      `paykit-earnings-${report.year}.csv`,
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      Download CSV
    </Button>
  );
}
