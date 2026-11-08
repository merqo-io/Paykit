"use client";
import { RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@merqo/ui/primitives";

export function RadioOptionCard({
  value,
  label,
  hint,
  selected,
  compact = false,
}: {
  value: string;
  label: string;
  hint?: string;
  selected: boolean;
  compact?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start rounded-xl border",
        compact ? "gap-2 px-3 py-2.5" : "gap-3 px-4 py-3",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border bg-card hover:bg-secondary/50",
      )}
    >
      <RadioGroupItem value={value} aria-label={label} className="mt-0.5" />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {hint && (
          <span className="block text-xs text-muted-foreground">{hint}</span>
        )}
      </span>
    </label>
  );
}
