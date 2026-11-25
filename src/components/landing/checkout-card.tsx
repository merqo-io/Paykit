/**
 * A static sample of the pay page a customer sees: stall, amount, PayNow QR.
 * The QR is a silhouette, not a scannable payload.
 */
export function CheckoutCard() {
  return (
    <figure
      className="w-full max-w-sm rounded-lg border bg-card p-5"
      aria-label="Sample paykit pay page"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold leading-tight">
            Ah Seng Kopi
          </p>
          <p className="text-sm text-muted-foreground">Order #A82F</p>
        </div>
        <p className="font-display text-2xl font-semibold tabular-nums">
          S$7.80
        </p>
      </div>

      <div
        className="mt-5 grid grid-cols-6 gap-1 rounded-lg bg-muted p-4"
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
      <p className="mt-3 text-center text-sm text-muted-foreground">
        Scan with your bank app to pay by PayNow
      </p>

      <figcaption className="mt-4 flex items-center gap-2 border-t pt-3 text-sm">
        <span className="size-1.5 rounded-full bg-mint" aria-hidden />
        <span className="font-medium">Customer says paid</span>
        <span className="ml-auto text-muted-foreground">To confirm</span>
      </figcaption>
    </figure>
  );
}

const QR_PATTERN = [
  [1, 1, 1, 0, 1, 1],
  [1, 0, 1, 1, 0, 1],
  [1, 1, 0, 1, 1, 0],
  [0, 1, 1, 0, 1, 1],
  [1, 0, 1, 1, 0, 1],
  [1, 1, 0, 1, 1, 1],
];
