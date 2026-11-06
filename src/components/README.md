# components

Paykit-specific client adapters and presentation. Shared controls live in
`@merqo/ui`; raw CLI-managed primitives live under `ui/`.

- `dashboard-tour.tsx` adapts routing, mark-seen action and `tour-steps.ts` to
  the shared tour (its Reports step anchors on `nav-reports`). Step descriptions render the real transaction-status badge
  into static markup; their HTML is authored configuration, not customer input.
- Dashboard page chrome (`PageHeader`, `EmptyState`) and the navigation plan chip
  (`TierChip`) come from `@merqo/ui`; there are no local copies.
- `site-footer.tsx` — `SiteFooter({ showSignIn })`, paykit's copy of the
  family footer: `@merqo/ui`'s `Footer` with the paykit wordmark (linking to
  `/`), the tagline "A shared payment setup for merqo vendors." and `kitName`.
  It renders the wordmark, tagline, copyright
  line, an `/about` link, Terms/Privacy and, with `showSignIn`, a
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
