import { ProLock, StatTile } from "@merqo/ui";
import type { DayTotal } from "@/lib/free-limits";
import { formatCents } from "@/lib/utils";

function DayTile({ label, total }: { label: string; total: DayTotal }) {
  return (
    <div className="rounded-xl border p-4">
      <StatTile
        label={label}
        value={formatCents(total.cents)}
        caption={`${total.count} payment${total.count === 1 ? "" : "s"}`}
        className="gap-0"
        labelClassName="text-xs"
        valueClassName="mt-1 font-display text-xl font-semibold tracking-tight leading-normal"
      />
    </div>
  );
}

export function FreeRevenueSummary({
  today,
  yesterday,
}: {
  today: DayTotal;
  yesterday: DayTotal;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <DayTile label="Today" total={today} />
        <DayTile label="Yesterday" total={yesterday} />
      </div>
      <ProLock
        label="Weekly and monthly revenue are included with Starter and Pro"
        href="/dashboard/plan"
      />
    </div>
  );
}
