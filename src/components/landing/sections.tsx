import Link from "next/link";
import { FaqRows } from "@merqo/ui";
import { Button } from "@merqo/ui/primitives";

import { FAQ_GROUPS } from "@/app/faq/faq-content";

import { CONTAINER, SECTION_PAD_Y } from "./rhythm";
import { PILOT_PRICING_LINE, WAITLIST_URL } from "./waitlist";

const H2 =
  "text-balance font-display text-[clamp(32px,4.2vw,52px)] font-semibold leading-[1.05] tracking-[-0.015em]";

// The three objections a vendor raises first: the money, the proof and the
// first-time setup. The rest stay on /faq.
const LANDING_FAQ_QUESTIONS = [
  "Does paykit hold my money?",
  "How do I know a payment came through?",
  "Do I need a business bank account?",
];

const LANDING_FAQ_ROWS = LANDING_FAQ_QUESTIONS.map((q) => {
  const row = FAQ_GROUPS.flatMap((g) => g.rows).find((r) => r.q === q);
  if (!row) throw new Error(`Landing FAQ question missing from /faq: ${q}`);
  return row;
});

export function LandingFaq() {
  return (
    <section id="faq" className={`scroll-mt-20 border-t ${SECTION_PAD_Y}`}>
      <div className={CONTAINER}>
        <div className="grid gap-10 min-[960px]:grid-cols-[1fr_1.4fr] min-[960px]:gap-16">
          <h2 className={H2}>Questions vendors ask first.</h2>
          <div>
            <FaqRows rows={LANDING_FAQ_ROWS} />
            <p className="mt-4">
              <Link
                href="/faq"
                className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4 hover:no-underline"
              >
                More questions and answers
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingClosing() {
  return (
    <section className={`border-t ${SECTION_PAD_Y}`}>
      <div className={CONTAINER}>
        <div className="grid gap-8 min-[960px]:grid-cols-[1fr_1.4fr] min-[960px]:gap-16">
          <h2 className={H2}>Put PayNow on your stall.</h2>
          <div>
            <p className="text-lg leading-[1.55]">{PILOT_PRICING_LINE}</p>
            <div className="mt-6">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-lg px-[26px] text-base font-semibold"
              >
                <a href={WAITLIST_URL}>Join the waitlist</a>
              </Button>
            </div>
            <p className="mt-6 text-muted-foreground">
              The money goes to you, not through us. paykit never holds funds.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
