import { Badge } from "@merqo/ui/primitives";

/** Decorative checkout stand-in for the hero, not a scannable QR. */
export function CheckoutCard() {
  return (
    <div className="w-full max-w-sm rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Scan to pay with PayNow
        </span>
        <Badge variant="outline" className="text-[10px]">
          preview
        </Badge>
      </div>

      <div
        className="mt-4 grid grid-cols-6 gap-1 rounded-lg bg-muted p-4"
        aria-hidden
      >
        {QR_PATTERN.map((row, i) =>
          row.map((on, j) => (
            <span
              key={`${i}-${j}`}
              className={
                on
                  ? "aspect-square rounded-[2px] bg-foreground"
                  : "aspect-square rounded-[2px] bg-transparent"
              }
            />
          )),
        )}
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="font-display text-2xl font-semibold tracking-tight">
          PayNow
        </span>
        <span className="text-xs text-muted-foreground">Sample</span>
      </div>

      <div className="mt-3 flex items-center gap-2 border-t pt-3">
        <span className="size-1.5 rounded-full bg-mint" aria-hidden />
        <span className="text-sm font-medium">Confirmed</span>
        <span className="ml-auto text-xs text-muted-foreground">#A82F</span>
      </div>
    </div>
  );
}

// Purely decorative — a plausible-looking QR silhouette, not a real payload.
const QR_PATTERN = [
  [1, 1, 1, 0, 1, 1],
  [1, 0, 1, 1, 0, 1],
  [1, 1, 0, 1, 1, 0],
  [0, 1, 1, 0, 1, 1],
  [1, 0, 1, 1, 0, 1],
  [1, 1, 0, 1, 1, 1],
];
