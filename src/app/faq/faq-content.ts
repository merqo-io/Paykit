import type { FaqGroup } from "@merqo/ui";

import { PILOT_PRICING_LINE } from "@/components/landing/waitlist";

export const FAQ_INTRO =
  "paykit shows your customer a PayNow QR and keeps track of who has paid. It is in build, built but not yet tried with vendors.";

export const FAQ_GROUPS: FaqGroup[] = [
  {
    id: "paying",
    heading: "How paying works",
    rows: [
      {
        q: "Does paykit hold my money?",
        a: "No. paykit only shows your PayNow QR (or your own payment link or QR) and tracks its status. Customers pay you directly, and paykit never touches funds.",
      },
      {
        q: "How do I know a payment came through?",
        a: "A customer uploads a screenshot of the payment and marks the order as paid. You confirm it yourself, in the kit that took the order, once you see it land in your bank account. There's no automatic bank-side verification.",
      },
      {
        q: "What does my customer see and do?",
        a: 'They see who they are paying and the amount, with a PayNow QR they can scan or save. They upload a screenshot of the payment and tap "I\'ve paid".',
      },
      {
        q: "What if the money does not arrive?",
        a: 'The order stays at "Marked paid" until you confirm it, so check your account first. paykit cannot start, approve or reverse a transfer.',
      },
    ],
  },
  {
    id: "setup",
    heading: "Setting up",
    rows: [
      {
        q: "Do I need a business bank account?",
        a: "No. Use PayNow with your UEN or personal mobile number, or bring your own payment link/QR (GrabPay, HitPay, Qashier, or your bank's own) instead.",
      },
      {
        q: "What do I need to set up?",
        a: "Your payee name plus your UEN or mobile number for PayNow. If you use another provider, paste your own payment link or QR instead.",
      },
      {
        q: "Does paykit work with other Merqo kits?",
        a: "qkit sends its orders to paykit to collect payment. Other kits are not connected to paykit yet.",
      },
    ],
  },
  {
    id: "cost-and-data",
    heading: "Cost and your data",
    rows: [
      { q: "What will it cost?", a: PILOT_PRICING_LINE },
      {
        q: "What does paykit keep about a payment?",
        a: "Payment screenshots are kept with the order and are not deleted automatically. Your data is hosted in Singapore.",
      },
    ],
  },
];
