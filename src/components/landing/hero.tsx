import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge, Button } from "@merqo/ui/primitives";

import { CheckoutCard } from "./checkout-card";
import { WAITLIST_URL } from "./waitlist";

const STATS = [
  { value: "0", label: "funds held by paykit" },
  { value: "2", label: "ways to get paid: PayNow or your own link" },
  { value: "3", label: "payment steps: waiting, paid, confirmed" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-32 h-96 opacity-40 blur-3xl"
        style={{
          background:
            "radial-gradient(45% 60% at 20% 30%, var(--color-mint), transparent 70%), radial-gradient(40% 55% at 80% 20%, var(--color-flow), transparent 70%)",
        }}
      />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 sm:py-28 lg:grid-cols-2 lg:items-center">
        <div className="fade-rise">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="text-xs">
              In build
            </Badge>
            <p className="text-sm text-muted-foreground">
              Built, not yet tried with vendors.
            </p>
          </div>
          <h1 className="mt-4 text-balance font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
            One payment setup for every kit.
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            paykit shows your customers a PayNow QR, or your own payment link or
            QR, and tracks who&apos;s paid. It never touches the money. qkit is
            the first kit built to use it.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <a href={WAITLIST_URL}>
                Join the waitlist
                <ArrowRight className="size-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="#how">See how it works</Link>
            </Button>
          </div>

          <dl className="mt-12 grid max-w-md grid-cols-3 gap-6 border-t pt-8">
            {STATS.map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd className="font-display text-2xl font-semibold tracking-tight text-mint sm:text-3xl">
                  {s.value}
                </dd>
                <dd className="mt-1 text-xs leading-tight text-muted-foreground">
                  {s.label}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="fade-rise flex justify-center lg:justify-end">
          <CheckoutCard />
        </div>
      </div>
    </section>
  );
}
