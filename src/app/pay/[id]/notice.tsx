/**
 * The one full-width message the pay page shows when there is no payment to
 * act on (recorded, too many tries, could not load). The caller supplies the
 * surrounding `main`.
 */
export function Notice({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="mx-auto max-w-sm space-y-3 px-5 py-10 text-center">
      <h1 className="font-display text-2xl font-semibold text-balance">
        {title}
      </h1>
      <p className="text-sm text-muted-foreground">{detail}</p>
    </section>
  );
}
