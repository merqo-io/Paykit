import Link from "next/link";
import { Badge, Button } from "@merqo/ui/primitives";

import { CheckoutCard } from "./checkout-card";
import { CONTAINER } from "./rhythm";
import { WAITLIST_URL } from "./waitlist";

export function Hero() {
  return (
    <section className="pt-[clamp(40px,7vw,96px)] pb-[clamp(56px,8vw,112px)]">
      <div className={CONTAINER}>
        <div className="grid items-center gap-10 min-[960px]:grid-cols-[1.05fr_1fr] min-[960px]:gap-16">
          <div className="min-w-0">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="rounded-lg">
                In build
              </Badge>
              <p className="text-sm text-muted-foreground">
                Built, not yet tried with vendors.
              </p>
            </div>
            <h1 className="text-balance font-display text-[clamp(40px,6vw,76px)] font-semibold leading-[1.02] tracking-[-0.02em]">
              Get paid by PayNow. Know who has paid.
            </h1>
            <p className="mt-6 max-w-[34em] text-[clamp(17px,1.6vw,20px)] leading-[1.55] text-muted-foreground">
              Set up your PayNow once. Every order gets a QR your customer scans
              in their own bank app. You see the payment in your account,
              confirm it, and paykit keeps the record.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-lg px-[26px] text-base font-semibold"
              >
                <a href={WAITLIST_URL}>Join the waitlist</a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 rounded-lg px-[26px] text-base font-semibold"
              >
                <Link href="#how">See how</Link>
              </Button>
            </div>
          </div>
          <div className="flex min-w-0 justify-center min-[960px]:justify-end">
            <CheckoutCard />
          </div>
        </div>
      </div>
    </section>
  );
}
