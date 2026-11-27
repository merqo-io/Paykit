# components

Paykit-specific client adapters and presentation. Shared controls live in
`@merqo/ui`; raw CLI-managed primitives live under `ui/`.

- `app-link-provider.tsx` — `AppLinks`, a Client Component mounting `@merqo/ui`'s `AppLinkProvider` with `next/link`; the root layout renders it once. `app-link-provider.dom.test.tsx` covers it.
- `onboarding-checklist.tsx` (every done step shares one strikethrough style) is the "Get set up" card at the top of Home. It renders the state from `lib/onboarding.ts` (progress out of the three counted steps, step links, a greyed optional "Coming soon" GST step, the "You're set up" state) and hides itself on dismiss, calling `dismissOnboarding` best-effort. `onboarding-checklist.dom.test.tsx` covers it. The spotlight tour that preceded it is no longer mounted in Paykit.
- `list/` — shared list-page pieces for the ledger, bookings and admin lists:
  `ListError` (`role="alert"` failed-read card with a Try again link and an
  optional `message`), `UrlPager` (server-rendered real-anchor pager with
  `rel=prev/next`, 44px targets and a caller-supplied `href(page)` that keeps
  filters) and `FILTER_SELECT_CLASS` (native select styled like the `Input`,
  with its focus ring). Covered by `list-error.dom.test.tsx` and `url-pager.dom.test.tsx`.
- Dashboard page chrome (`PageHeader`, `EmptyState`) and the navigation plan chip
  (`TierChip`) come from `@merqo/ui`; there are no local copies.
- `nav/` — dashboard navigation pieces that import nothing paykit-specific, so
  they can move to `@merqo/ui` later: `BottomTabBar` (phone, fixed, safe-area
  aware, badge, More trigger), `SideRail` (`lg` and up) and `MoreSheet`
  (bottom sheet of setup pages and legal links). They take `NavLinkItem`s;
  `app/dashboard/dashboard-nav.tsx` builds those from `lib/nav.ts`.
  Covered by `nav.dom.test.tsx`.
- `page-shell.tsx` — `PageShell`, the dashboard page frame around `@merqo/ui`'s
  `PageHeader`: title, description, optional sub-tabs, `max-w-5xl` (list) or
  `max-w-2xl` (form) width, and a single action element that sits beside the
  title from `lg` and is anchored above the tab bar below it.
- `site-footer.tsx` — `SiteFooter({ showSignIn })`, paykit's copy of the
  family footer: `@merqo/ui`'s `Footer` with the paykit wordmark (linking to
  `/`), the tagline "A shared payment setup for merqo vendors." and `kitName`.
  It renders the wordmark, tagline, copyright
  line, an `/about` link, a `/faq` link (the shared `Footer`'s `faqHref`),
  Terms/Privacy and, with `showSignIn`, a
  `Vendor sign in →` link. The landing page and `/about` pass `showSignIn`;
  the dashboard leaves it off. Same shape as printkit's `site-footer.tsx`.
  `site-footer.dom.test.tsx` covers both forms.
- `landing/` contains the marketing sections, brand and shared-shell adapters.
  `BackToTop` is imported from the shared package; no local copy remains.
- `ui/` contains shadcn primitives. Regenerate them through the CLI rather than
  hand-editing their structure.

The dashboard navigation composes the shared account menu, which owns feedback
and support drawers. Profile forms import shared social-link fields, image
uploader and section layout directly. Former local social-icons, social-fields,
feedback, support, tooltip and section copies have been removed.

The avatar/QR upload backend remains in `lib/image-upload-adapter.ts` because
Storage buckets and object paths are application-specific. Shared UI tests cover
mechanisms; adapter tests cover Paykit's props, routes and action behavior.

## Parent

[src](../README.md)

`PageHeader`'s title wraps long words (`break-words`) so a long customer name never overflows the header.
