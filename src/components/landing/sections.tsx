import { FaqRows, type FaqRow } from "@merqo/ui";
import { Button } from "@merqo/ui/primitives";

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
    body: "The customer scans it in their own bank app and pays you directly. Their phone shows your stall name and the amount.",
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
          <h2 className={H2}>Three steps, and the second one is theirs.</h2>
          <ol className="divide-y divide-border">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex gap-5 py-6 first:pt-0">
                <span className="font-display text-3xl font-semibold tabular-nums text-mint">
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
        <div className={SPLIT}>
          <h2 className={H2}>The money goes to you, not through us.</h2>
          <div className="max-w-[34em] space-y-5 text-lg leading-[1.6] text-muted-foreground">
            <p>
              paykit never holds funds. The customer pays into your account, and
              the QR is only how they find it.
            </p>
            <p>
              Because a person confirms each payment, nothing is marked paid
              until you have seen it land. qkit checkout already runs on paykit,
              so a qkit stall gets this without extra setup.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const FAQ: FaqRow[] = [
  {
    q: "Does paykit hold my money?",
    a: "No. It shows your PayNow QR, or your own payment link or QR, and tracks the status. Customers pay you directly.",
  },
  {
    q: "How do I know a payment came through?",
    a: "The customer marks the order paid after scanning. You confirm it once you see it in your bank account. There is no automatic bank check.",
  },
  {
    q: "Do I need a business bank account?",
    a: "No. PayNow works with your UEN or your personal mobile number. You can also bring your own payment link or QR.",
  },
  {
    q: "What will it cost?",
    a: PILOT_PRICING_LINE,
  },
];

export function LandingFaq() {
  return (
    <section id="faq" className={`scroll-mt-20 border-t ${SECTION_PAD_Y}`}>
      <div className={CONTAINER}>
        <div className={SPLIT}>
          <h2 className={H2}>Questions stall owners ask.</h2>
          <FaqRows rows={FAQ} />
        </div>
      </div>
    </section>
  );
}

export function ClosingCta() {
  return (
    <section className={`border-t ${SECTION_PAD_Y}`}>
      <div className={CONTAINER}>
        <div className={`${SPLIT} items-end`}>
          <h2 className={H2}>Put PayNow on your stall.</h2>
          <div>
            <p className="max-w-[30em] text-lg text-muted-foreground">
              Join the waitlist and we will get in touch when your stall can be
              set up.
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
        </div>
      </div>
    </section>
  );
}
