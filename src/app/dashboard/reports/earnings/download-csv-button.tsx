"use client";

import { Button } from "@merqo/ui/primitives";

import { earningsReportToCsv } from "@/lib/earnings-csv";
import type { EarningsReport } from "@/lib/earnings-report";

export function DownloadCsvButton({ report }: { report: EarningsReport }) {
  function onClick() {
    const csv = earningsReportToCsv(report);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `paykit-earnings-${report.year}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      Download CSV
    </Button>
  );
}
