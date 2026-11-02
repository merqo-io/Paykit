import { Link2, ShieldCheck, Gauge, History } from "lucide-react";
import { PILOT_PRICING_LINE } from "./waitlist";

export function Benefits() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        Why paykit
      </p>
      <h2 className="mt-3 max-w-xl text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
        Built to be the one payment engine, not another one.
      </h2>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-6 sm:col-span-2 sm:row-span-2">
          <Link2 className="size-6 text-mint" aria-hidden />
          <h3 className="mt-4 font-display text-xl font-bold">
            One setup, kept in one place
          </h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            A vendor has one payment setup, not one per kit. Connect it once in
            paykit and the kits built to use it, starting with qkit, read it
            from there. No second config screen to maintain.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-6">
          <ShieldCheck className="size-6 text-mint" aria-hidden />
          <h3 className="mt-4 font-display text-lg font-bold">
            Never touches the money
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Customers pay straight into your own account. paykit only renders
            the checkout and tracks status. No funds pass through it.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-6">
          <History className="size-6 text-mint" aria-hidden />
          <h3 className="mt-4 font-display text-lg font-bold">
            Extracted, not rewritten
          </h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            The QR engine is ported from qkit&apos;s, not rewritten from
            scratch.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-6 sm:col-span-3">
          <Gauge className="size-6 text-mint" aria-hidden />
          <h3 className="mt-4 font-display text-lg font-bold">Pricing</h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
            {PILOT_PRICING_LINE}
          </p>
        </div>
      </div>
    </section>
  );
}
