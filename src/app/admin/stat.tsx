import { StatTile } from "@merqo/ui";
import { cn } from "@/lib/utils";

/** A back-office figure tile: wraps @merqo/ui's shared StatTile in a flat bordered card. */
export function Stat({
  label,
  value,
  caption,
  delta,
  deltaTooltip,
  className,
}: {
  label: string;
  value: string | number;
  caption?: string;
  /** Period-over-period delta, e.g. `pctChange(current, prior)`. Null renders no pill. */
  delta?: number | null;
  deltaTooltip?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", className)}>
      <StatTile
        label={label}
        value={String(value)}
        caption={caption}
        delta={delta}
        deltaSize="xs"
        deltaTooltip={deltaTooltip}
      />
    </div>
  );
}
