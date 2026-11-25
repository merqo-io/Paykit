import { FaqRows } from "@merqo/ui";
import { Button } from "@merqo/ui/primitives";

import { FAQ_GROUPS } from "@/app/faq/faq-content";

import { CONTAINER, SECTION_PAD_Y } from "./rhythm";
import { PILOT_PRICING_LINE, WAITLIST_URL } from "./waitlist";

const H2 =
  "text-balance font-display text-[clamp(32px,4.2vw,52px)] font-semibold leading-[1.05] tracking-[-0.015em]";
const SPLIT =
  "grid gap-10 min-[960px]:grid-cols-[1fr_1.4fr] min-[960px]:gap-16";

const STEPS = [
  {
    title: "Set up PayNow once",
    body: "Add your UEN or mobile number, or your own payment link or QR. It stays in paykit, so you never type it in again.",
  },
  {
    title: "Each order gets a QR",
    body: "The customer scans it in their own bank app and pays you directly. With PayNow details, the amount is filled in for them.",
  },
  {
    title: "You confirm it",
    body: "They tap that they have paid. You check your bank account, confirm, and paykit marks the order paid.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className={`scroll-mt-20 border-t ${SECTION_PAD_Y}`}>
      <div className={CONTAINER}>
        <div className={SPLIT}>
          <h2 className={H2}>How it works at your stall.</h2>
          <ol className="divide-y divide-border">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-5 py-6 first:pt-0">
                <span className="font-display text-3xl font-semibold tabular-nums text-success">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-xl font-semibold">{s.title}</h3>
                  <p className="mt-2 max-w-[34em] text-muted-foreground">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

export function YourMoney() {
  return (
    <section className={`border-t ${SECTION_PAD_Y}`}>
      <div className={CONTAINER}>
        <h2 className={`${H2} max-w-[18em]`}>
          The money goes to you, not through us.
        </h2>
        <p className="mt-6 max-w-[34em] text-xl leading-[1.55] text-muted-foreground">
          paykit never holds funds. The customer pays into your account, and a
          person confirms each payment, so nothing is marked paid until you have
          seen it land. qkit checkout already runs on paykit, so a qkit stall
          gets this without extra setup.
        </p>
      </div>
    </section>
  );
}

// The cost question is left out: PILOT_PRICING_LINE is shown beside the CTA.
const LANDING_FAQ_ROWS = FAQ_GROUPS.filter(
  (g) => g.id === "paying" || g.id === "setup",
)
  .flatMap((g) => g.rows)
  .slice(0, 5);

export function LandingFaq() {
  return (
    <section id="faq" className={`scroll-mt-20 border-t ${SECTION_PAD_Y}`}>
      <div className={CONTAINER}>
        <div className={SPLIT}>
          <div>
            <h2 className={H2}>Put PayNow on your stall.</h2>
            <p className="mt-5 max-w-[26em] text-lg text-muted-foreground">
              {PILOT_PRICING_LINE}
            </p>
            <div className="mt-6">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-lg px-[26px] text-base font-semibold"
              >
                <a href={WAITLIST_URL}>Join the waitlist</a>
              </Button>
            </div>
          </div>
          <FaqRows rows={LANDING_FAQ_ROWS} />
        </div>
      </div>
    </section>
  );
}
