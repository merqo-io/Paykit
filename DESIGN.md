# paykit design

This file records paykit's own design values. Shared rules are linked, not restated.

## Public pages

Public pages (landing, about, FAQ, legal) follow the shared rules at https://github.com/merqo-io/merqo-ui/blob/main/docs/public-page-rules.md, and this section never restates them, it only adds paykit's own values.

- Radius: `--radius` is `0.625rem` (`src/app/globals.css`).- Product object: the landing hero shows `CheckoutCard` (`src/components/landing/checkout-card.tsx`), a decorative PayNow checkout stand-in with a placeholder QR pattern, a "preview" badge and a "Sample" label. It is bordered with `border bg-card`, no shadow.
- Status: the landing says "In build" with "Built, not yet tried with vendors." (`src/components/landing/hero.tsx`). Other public pages match that wording until paykit is tried with vendors.
- Money copy: paykit never touches the money. It shows a PayNow QR or the vendor's own payment link or QR, and tracks status. Public copy claims no more than that.

### Open items

- Open: landing surfaces use `rounded-2xl`, not `rounded-lg` (`benefits.tsx`, `checkout-card.tsx`, `faq.tsx` in `src/components/landing/`).
- Open: the hero has a blurred radial-gradient glow and a load-time `fade-rise` animation (`src/components/landing/hero.tsx`).
