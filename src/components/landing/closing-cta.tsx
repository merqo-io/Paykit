import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WAITLIST_URL } from "./waitlist";

/** Inverted button colors keep it legible on the always-dark ink band in both themes. */
export function ClosingCta() {
  return (
    <section className="bg-ink text-ink-foreground">
      <div className="mx-auto max-w-6xl px-6 py-16 text-center sm:py-20">
        <h2 className="text-balance font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          One payment setup, ready to reuse.
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-ink-foreground/70">
          Built, not yet tried with vendors. Set up PayNow or your own payment
          link once, and keep it in one place.
        </p>
        <div className="mt-8 flex justify-center">
          <Button
            asChild
            size="lg"
            className="bg-ink-foreground text-ink hover:bg-ink-foreground/90"
          >
            <a href={WAITLIST_URL}>
              Join the waitlist
              <ArrowRight className="size-4" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
