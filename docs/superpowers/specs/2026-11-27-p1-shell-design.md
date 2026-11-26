# paykit P1 — Mobile-first shell, navigation and first-run onboarding — Design

Status: proposal for owner approval. No code is written until the open questions in section 7 are answered.

## Why

paykit is being repositioned from "PayNow QR plumbing" to the vendor's revenue back office. Phase 2 adds, in order: an audit trail (Ledger/Activity), GST, Expenses and P&L, Monthly close, and accounting exports. Phase 1 (this spec) changes only the vendor dashboard's navigation, app shell and first-run onboarding so those sections slot in without another redesign. It does not add any phase 2 feature, and it keeps the product rule that paykit never touches funds: nothing here moves, holds or initiates money.

Vendors are market and event stall operators who mostly use a phone, often one-handed, often at the stall. The shell is designed for a 390px viewport first and scaled up.

## Method and evidence limits

The page review follows impeccable's critique method (Assessment A: hierarchy, IA, cognitive load, states, copy, accessibility, heuristics) in Operate mode: scanability, consistency and native expectations outrank expression. The detector run (Assessment B) and sub-agent isolation were not run; this is a single-context review by a builder that cannot invoke skills, so treat it as a degraded critique.

Screenshot provenance: all screenshots come from `https://paykit-staging.merqo.io`, signed in as the owner's existing staging session (a vendor with real staging data), captured at a 1920px-wide viewport and downscaled (about 756px wide). **No 390px screenshots were captured**: the browser tool's window resize does not change the page viewport and the dashboard refuses to be framed, so no phone-width render was possible. Phone findings below are derived from reading the source (the `@merqo/ui` `DashboardNav` collapse rule, the page containers and tables) and are marked "(source)". The first thing S2 should do is capture real 390px baselines. Not captured at all: the public pay page (`/pay/[id]`) and inquiry form (`/inquire/[publicId]`), which need a live id; admin pages (out of scope for P1); loading and empty states.

Screenshots live in `assets/p1-shell/`.

## 1. Page audit

### What the shell does today

`src/app/dashboard/layout.tsx` renders `@merqo/ui`'s `DashboardNav` (a sticky top bar), a `main` capped at `max-w-7xl` with `px-5 py-7`, `SiteFooter`, and the `DashboardTour`. `DashboardNav` at phone width (source, `merqo-ui/src/dashboard-nav.tsx`): below `sm` (640px) it shows a burger on the left, then the wordmark, with the `AccountMenu` on the right. The three links (Payments, Bookings, Reports) are hidden inside the burger panel, which drops down from the header. "Payment setup", Plan, Profile, Help, Feedback and the kit switcher live in the account menu. So at 390px every destination, including the one the vendor needs most on day one (Payment setup), is two taps deep, and the primary navigation is not visible at all.

### Cross-page findings (ranked)

1. **P1 — Navigation hidden on the device that matters.** Burger-only nav at phone width means no wayfinding and a top-of-screen reach target for a one-handed thumb user. Adding five phase 2 sections to a burger makes this worse, not better. (source)
2. **P1 — Inconsistent content width and no page frame.** Each page picks its own container: Payments is full `max-w-7xl`, Bookings `max-w-4xl`, Reports `max-w-3xl`, Plan and Profile `max-w-2xl`, Payment setup `max-w-lg`. On desktop the title and content shift left/right between pages (compare the desktop screenshots). There is no shared page title/action pattern.
3. **P2 — Overview is named "Payments" and is thin.** `/dashboard` is titled Payments but the nav link "Payments" goes to `/dashboard/transactions`. Two pages share one name and the home route is not in the nav (only the wordmark links to it). The home page is two stat cards, a text link and the payment method; it does not tell the vendor what to do next.
4. **P2 — Primary actions are not placed for the thumb.** "New booking" and "Set up inquiry form" sit top-right on Bookings; Save buttons sit at the end of long forms. On a phone the top-right is the hardest place to reach.
5. **P2 — Onboarding is a spotlight tour, not progress.** The driver.js tour highlights nav items that, on mobile, are collapsed; the mobile variant reduces to three steps. It shows once, then lives behind a floating replay button, and says nothing about whether setup is actually done.
6. **P3 — Dense default type.** Stat labels and captions are very small and low-contrast on the dark theme (desktop screenshots); this needs a contrast check at 390px in S2.
7. **P3 — Footer on every dashboard page** (About, FAQ, Terms, Privacy) competes with the future "More" area for the same job.

### Per page

**Overview `/dashboard`** ([desktop](assets/p1-shell/dashboard-desktop.jpg)). Two stat cards (waiting to confirm, confirmed this month), "Review these payments", payment method summary. Strengths: the "waiting for you to confirm" number is the right hero. Issues: stat cards stretch into two wide empty tiles on desktop with a lot of dead space below; the "Review" action is a small underlined text link, not a button; no recent-activity list; the unconfigured state (no PayNow yet) is a lone heading and button with no sense of steps. Phone (source): the grid collapses to one column, which is fine; the issue is the missing next-step prompt. This page is where the onboarding checklist (section 4) and the phase 2 "this month" summary will live.

**Payments `/dashboard/transactions`** ([desktop](assets/p1-shell/payments-desktop.jpg)). Search, status, from/to filters and an Apply button above a wide table (Kit, Reference, Amount, Status, Created, Refund). Issues: the reference column is a long raw UUID-style string, the dominant text, while the amount and status that the vendor scans for are small; filters are a row of five controls; the table is `overflow-x-auto` and scrolls sideways on a phone rather than reflowing (source: `transactions/README.md`), which hides Status and the Refund action off-screen. Needs a phone card/list row: amount and status first, kit and date secondary, reference tucked behind a tap. This is the highest-value page and the worst at 390px.

**Bookings `/dashboard/bookings`** ([desktop](assets/p1-shell/bookings-desktop.jpg)). Title with "New booking" and "Set up inquiry form" top right, Inquiries (0), Your bookings table. Issues: two unrelated primary actions of equal weight; the inquiries empty state is one grey line; the table also scrolls sideways on a phone (`booking-table.tsx` `overflow-x-auto`); narrower container than Payments.

**Reports `/dashboard/reports`** ([desktop](assets/p1-shell/reports-desktop.jpg)). Overview/Earnings tabs, three metrics, a bar chart. Issues: axis labels are near-invisible; the chart has no per-bar value or tap target on a phone; this page is the natural parent of the phase 2 P&L and exports, so it should become a hub rather than keep its own bare tabs. `/dashboard/stats` redirects here (screenshot shows the blank page the redirect passes through; it needs no design work).

**Payment setup `/dashboard/config`** ([desktop](assets/p1-shell/config-desktop.jpg)). Method radio cards, payee fields, a live sample QR preview, Save at the bottom. Strengths: the live QR preview is excellent and is the best activation moment in the product; it already acts as "preview a test QR". Issues: reached only through the account menu (hidden on phone); on a phone the Save button is far below the preview (source: single column); no confirmation that setup is complete beyond the save.

**Plan `/dashboard/plan`** ([desktop](assets/p1-shell/plan-desktop.jpg)). Tier cards with a "Change plan in your Merqo account" link. Issues: three cards in an uneven grid (the Pro card wraps under Free); it is the natural home for the free vs paid comparison that phase 2 needs, but today it lists only the old tiers; only reachable from the account menu.

**Profile `/dashboard/profile`** ([desktop](assets/p1-shell/profile-desktop.jpg)). Business name, links, account card. Issues: four social link fields are loaded up front on a page the vendor visits once; two separate Save buttons on one scroll; fine otherwise.

**Admin `/admin`.** Out of scope for P1 (different audience and shell); noted so S2 does not accidentally couple to it.

**Pay page `/pay/[id]` and inquiry form `/inquire/[publicId]` (brief; not captured).** These are customer-facing and already phone-first by nature. No shell changes. For S2, check them at 390px only to confirm that nothing in the new shell tokens/spacing leaks into them; any redesign is a separate brief.

### Heuristic summary (impeccable, 0-4)

Visibility of system status 2 (no setup progress, no loading skeleton beyond a generic `loading.tsx`); Match with real world 3; User control 3; Consistency 2 (container widths, "Payments" naming); Error prevention 3; Recognition over recall 1 (burger hides all sections); Flexibility 2; Aesthetic and minimal 3; Error recovery 3; Help 2 (tour then nothing). Cognitive load: the account menu mixes setup, plan, profile, help, feedback and kit switching in one dropdown, which breaks the "at most 4 visible options per decision" guidance.

## 2. Information architecture

### Principles

- Tasks the vendor does daily (confirm a payment, look up a payment, check today's total) are one tap from anywhere.
- Setup and housekeeping (payment setup, profile, plan, help) are reachable but not primary.
- Phase 2 sections appear in the nav only when they exist; locked paid sections are visible with the existing `TierChip` pattern so the upgrade path is discoverable, not hidden.

### Phone (below 640px): bottom tab bar with four slots plus More

A bottom tab bar replaces the burger. Justification: the vendor holds the phone one-handed at a stall; the bottom edge is the reach zone; five or fewer persistent destinations is the established native pattern; and it makes the current section visible at all times (fixing the Recognition-over-recall gap). Alternatives considered: (a) keep the burger and add more items, rejected because it hides everything and grows with phase 2; (b) a horizontally scrolling top tab strip, rejected because it hides sections off-screen and fights the Payments table's own horizontal scroll; (c) a floating action button, rejected as the only nav but kept for the contextual primary action (section 3).

Tabs, left to right:

| Slot | Label    | Route                     | Notes                                                                                              |
| ---- | -------- | ------------------------- | -------------------------------------------------------------------------------------------------- |
| 1    | Home     | `/dashboard`              | Today's number, waiting-to-confirm, checklist. Renamed from "Payments" so the name is unique.      |
| 2    | Payments | `/dashboard/transactions` | Badge with the count of payments waiting to confirm.                                               |
| 3    | Bookings | `/dashboard/bookings`     | Only shown for vendors who use bookings (see open question 3); otherwise the slot goes to Reports. |
| 4    | Reports  | `/dashboard/reports`      | Becomes "Books" when phase 2 lands (see below).                                                    |
| 5    | More     | opens a sheet             | Everything else.                                                                                   |

The bar is `print:hidden`, honours the safe-area inset, tap targets at least 44px, and shows an icon plus a label (no icon-only tabs). The page content gets matching bottom padding.

### Desktop (640px and up): keep the top bar, add a left rail from `lg`

At `sm` to `md` the existing inline links stay. From `lg` (1024px) a collapsible left sidebar carries the same destinations as the tab bar plus grouped phase 2 sections, because five-plus items with free/paid chips outgrow a top bar and a sidebar scales with section count. The top bar keeps the wordmark, kit switcher, tier chip and account menu. Both desktop forms read from the one nav config (section 5).

### Where today's pages and the five future sections live

Grouped so the bar never needs more than four tabs plus More:

- **Home**: Overview.
- **Payments**: Payments list, and (later) the Ledger/Activity view as a tab inside it ("Payments | Activity"). Activity is the audit log, free, and is about payments events, so it belongs next to them. Phase 2 slice 1.
- **Bookings**: Bookings and Inquiries (unchanged).
- **Books** (rename of Reports, once phase 2 starts; "Reports" until then): a section with its own sub-navigation: Overview and Earnings (today's tabs), then GST (paid), Expenses and P&L (paid), Monthly close (paid), Exports. Exports itself is a tab: simple CSV is free, accounting formats are paid, so the tab is visible to all and the paid formats show the `TierChip`. This keeps four of the five phase 2 sections off the primary bar and under one parent, so adding them never changes the bar.
- **More** (sheet on phone, account area on desktop): Payment setup, Profile, Plan, Help, Send feedback, Switch kit, Sign out, and the legal links currently in the footer (About, FAQ, Terms, Privacy). The footer is dropped from dashboard pages on phone.

Why Payment setup is in More and also surfaced elsewhere: after onboarding it is a rarely used settings page, but before and during onboarding it is the vendor's first task. So it is reachable from More always, and from the checklist and the Home empty state until setup is done (section 4). Locked sections: a paid section the vendor's plan does not include is still listed, shows a `TierChip`, and opens a short what-you-get page with the plan link, not a dead end. Free vs paid uses the existing plan pattern (`TierChip`, `/dashboard/plan`).

Decision to confirm with the owner: whether the paid sections sit under "Books" (this proposal) or as separate top-level items. Open question 1.

## 3. Shell

### Header

Phone: a slim top bar with the wordmark on the left and the avatar (account menu) on the right; no burger. The sticky bar remains, since the kit switcher and account menu need a home, but it carries no navigation. Desktop: unchanged wordmark and inline links to `lg`, then rail. The tier chip stays next to the avatar.

### Page title pattern

One `PageShell` pattern used by every dashboard page: title (page name, one line), optional one-line description, an optional right-aligned action slot on desktop, optional sub-tabs below. One consistent container width for list pages (`max-w-5xl`) and a narrower one (`max-w-2xl`) for form pages (Payment setup, Profile, Plan), replacing the six current widths. On phone the title sits under the top bar, at the same size on every page.

### Primary action placement on phone

One primary action per page, as a full-width or bottom-anchored button in the thumb zone, above the tab bar: Payments, "Review payments to confirm" when something is waiting; Bookings, "New booking" (with "Set up inquiry form" demoted to a secondary row in the page, not the header); Payment setup, a sticky Save bar above the tab bar while the form is dirty. Anchored actions sit above the tab bar and respect the safe area. On desktop the action returns to the title row's right side.

### States

- **Empty states** are specific to what the section is for and give one next action: Payments with no payments says how a first payment arrives (a kit checkout, or a booking) and links to Payment setup if that is not done; Bookings inquiries empty says what an inquiry is and links to Set up inquiry form; the new phase 2 sections get the same shape. They also feed the checklist.
- **Loading**: a skeleton matching the page's real layout (title, two stat cards, five list rows) replaces the generic loader, so the shell does not jump. The tab bar and header never re-render during navigation.
- **Error**: keep `error.tsx`, with the same title/frame so the vendor can still navigate away.

### Payments and Bookings on phone

Tables reflow into list rows below 640px: line one amount and status, line two kit and date, tap to expand reference and the Refund or reschedule action. This is shell work because it is the main reason the phone experience is poor; it lands in S2 together with the nav so the new tab bar is not wrapped around an unusable page.

## 4. Onboarding

### Proposal: a first-run checklist on Home that replaces the spotlight tour

A "Get set up" card at the top of Home, visible until complete or dismissed, with progress ("2 of 4"):

1. **Add your PayNow details** (or your own payment link/QR). Done when a `vendor_payment_config` row exists. Link: Payment setup.
2. **Preview your QR.** Done when the vendor has viewed the sample QR preview on Payment setup (the existing live preview), recorded on first visit to the saved config page or as a "previewed" timestamp. It reassures the vendor that the QR will scan.
3. **Take your first payment and confirm it.** Done when there is at least one `confirmed` transaction. This is derived from existing data; nothing to store. Copy explains that the vendor confirms only after checking the money has landed in their bank app, which restates "paykit never touches funds".
4. **Optional, later: GST profile.** Shown greyed as "Coming soon" until GST ships; becomes a real step in phase 2. Optional steps do not block "complete".

Completion state is mostly derived from existing tables, so there is little to persist and it cannot drift from reality. Only two things need storing in `vendor_prefs`: `onboarding_dismissed_at` (vendor hid the checklist) and `qr_previewed_at` (step 2). Both are small nullable timestamps in a migration plus the matching `src/lib/db-types/` change, per the repo's schema rule. No new table.

### Relation to the current tour

The tour (`DashboardTour`, `tour_seen_at`, `data-tour` anchors, `tour-steps.ts`, the `stampTourSeen` stamp in `dashboard/page.tsx`) is built for desktop nav landmarks and degrades to three steps on mobile; with the nav moving to a tab bar its anchors (`nav-*`, `nav-menu`) no longer exist. Recommendation: retire the tour for new vendors once the checklist ships, rather than rewrite its anchors. `tour_seen_at` is kept as a column and treated as "this vendor has already onboarded" so existing vendors do not see the checklist (they see it only if step 1 is genuinely not done). The shared `DashboardTour` stays in `@merqo/ui` for the other kits; paykit just stops mounting it. If the owner would rather keep a replay for existing vendors, a small "Take a tour" item in More can mount it. Open question 4.

### Dismissal and persistence

Dismiss with an X: sets `onboarding_dismissed_at`, hides the card, and leaves a "Setup guide" row in More that reopens it. The card also disappears by itself when steps 1 to 3 are done, with a short "You're set up" confirmation the first time. Failed writes are best-effort (same as the tour today) and must never be used for authorization.

## 5. Build location: paykit-local vs upstream in @merqo/ui

Current coupling: qkit, loopkit and stockkit use `@merqo/ui` `DashboardNav` as the burger-plus-inline-links bar. paykit pins a git sha. Changing `DashboardNav` upstream changes those kits the moment they bump the sha, so upstream work must be additive and opt-in.

| Piece                                                                     | Where                                                                                      | Why / impact                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Nav config (one list: key, label, icon, href, tier, children, `showWhen`) | paykit-local, `src/lib/nav.ts`                                                             | Pure data, unit-testable, drives bar, rail, More sheet and locked-section chips. No effect on other kits.                                                                                                                                                                |
| `BottomTabBar` (phone tab bar, badge, safe-area, More trigger)            | paykit-local first; propose upstream later                                                 | Other kits could want it, but designing it generically before paykit has proven it is premature (the repo's own reuse spec favours consolidating proven duplicates). Build it paykit-local with no paykit imports so it can be lifted. No effect on other kits in P1.    |
| `MoreSheet`                                                               | paykit-local                                                                               | Contains paykit-specific items (Payment setup, plan, legal). Reuse the shared `AccountMenu` pieces (help form, feedback sheet, kit switcher) by composition.                                                                                                             |
| Top bar without burger on phone                                           | upstream, additive: a `DashboardNav` prop such as `hideBurger` / `navLinks={[]}` behaviour | Smallest upstream change. Must default to today's behaviour so qkit, loopkit, stockkit are unchanged until they opt in. Needs a `@merqo/ui` release and sha bump in paykit. Open question 5 (whether to avoid upstream entirely by not using `DashboardNav` for paykit). |
| Left rail (`lg`)                                                          | paykit-local                                                                               | Same reasoning as the tab bar.                                                                                                                                                                                                                                           |
| `PageShell` / title + action slot                                         | paykit-local                                                                               | The shared `@merqo/ui` `PageHeader` is already used; wrap it locally. Candidate to upstream later.                                                                                                                                                                       |
| Phone list rows for Payments/Bookings                                     | paykit-local                                                                               | Domain-specific.                                                                                                                                                                                                                                                         |
| Onboarding checklist card                                                 | paykit-local                                                                               | paykit-specific steps. The generic progress-card visual could go upstream later.                                                                                                                                                                                         |
| `DashboardTour`                                                           | stays upstream, unchanged                                                                  | Other kits still use it; paykit stops mounting it.                                                                                                                                                                                                                       |
| `TierChip` for locked sections                                            | already upstream, reused as is                                                             | No change.                                                                                                                                                                                                                                                               |

Net: P1 needs at most one small additive upstream change (hide the burger), and only if the owner prefers reusing `DashboardNav`'s header over a paykit-local top bar. The risk to avoid is shipping a breaking `DashboardNav` change that shifts the other three kits' phone nav without their owners asking.

## 6. Implementation slices

Slices have disjoint file lists so they can run in parallel branches after S1 is merged. `src/app/dashboard/**/page.tsx` bodies are touched by one slice each.

- **S1: this spec** (docs only; approved by the owner before S2/S3 start).
- **S2: shell and navigation.** Capture 390px baselines first. Files: `src/lib/nav.ts` (new) and its test; `src/components/nav/bottom-tab-bar.tsx`, `more-sheet.tsx`, `side-rail.tsx` (new, with DOM tests); `src/app/dashboard/dashboard-nav.tsx` (rewire to the config, drop burger on phone); `src/app/dashboard/layout.tsx` (mount bar, bottom padding, hide footer on phone, stop mounting `DashboardTour` only in S3 so S2 leaves it as is); `src/components/page-shell.tsx` (new; wraps the shared `PageHeader` with the action slot and container width); `src/app/dashboard/{plan,profile,config}/page.tsx` (container width only); `src/app/dashboard/loading.tsx`. Docs: `src/app/dashboard/README.md`, `src/components/README.md`, `docs/FILE-LAYOUT.md`. Possibly the upstream `DashboardNav` prop change in the merqo-ui repo and the sha bump in `package.json` and `pnpm-lock.yaml`.
- **S2b: phone reflow of Payments and Bookings.** Files: `src/app/dashboard/transactions/{transaction-table,transaction-filters}.tsx`, `src/app/dashboard/bookings/{booking-table,page}.tsx` and their tests, plus matching README lines. Separate from S2 so the nav can merge without waiting on the list redesign; depends on S2's page shell.
- **S3: onboarding.** Files: new migration in `supabase/migrations/` (`vendor_prefs.onboarding_dismissed_at`, `qr_previewed_at`), `src/lib/db-types/` edit, `src/lib/onboarding.ts` (derive step state) and test, `src/components/onboarding-checklist.tsx` and DOM test, `src/app/dashboard/onboarding-actions.ts` (dismiss, preview stamps), `src/app/dashboard/page.tsx` (Home: checklist, next-step prompt, stat cards), `src/app/dashboard/config/payment-config-form.tsx` (record preview), pgTAP test for the new columns, `src/components/dashboard-tour.tsx`, `src/components/tour-steps.ts` and `src/app/dashboard/tour-actions.ts` retired or reduced per open question 4, `src/lib/tour-prefs.ts` kept for the `tour_seen_at` legacy meaning. Depends on S2 only for the Home container; can be developed in parallel.
- **S4 (optional): Home overview content.** Today's total, recent five payments, quiet "this month" line reserved for phase 2. Files: `src/app/dashboard/page.tsx` stat section only, so it must follow S3 (same file).

Each slice includes its own tests (unit, DOM, pgTAP where schema changes) and README updates, and goes to `staging` through a `feat/*` branch.

## 7. Open questions for the owner

1. **Books grouping.** Do the paid phase 2 sections (GST, Expenses and P&L, Monthly close, Exports) sit under one "Books" section (this proposal) or as separate top-level items? Under "Books" keeps the phone tab bar at four plus More.
2. **Rename.** Is renaming Overview to "Home" and Reports to "Books" (when phase 2 begins) acceptable, given vendors and the FAQ/landing copy use "Payments" and "Reports" today?
3. **Bookings tab.** Do all vendors see a Bookings tab, or only vendors who have used bookings or inquiries? Today it is for everyone. Hiding it for most vendors frees a tab for Activity.
4. **Tour.** Retire the spotlight tour for new vendors (this proposal), or keep it and add the checklist alongside? Should existing vendors see the checklist at all?
5. **Upstream vs local top bar.** Is a small additive `DashboardNav` change in `@merqo/ui` acceptable (with the other kits unaffected until they opt in), or should paykit use its own top bar and not depend on `DashboardNav` at all?
6. **Locked sections.** Show paid sections to Free vendors with a `TierChip` and an explainer page (proposal), or hide them until the vendor is on a paid plan?
7. **Plan page.** The Plan page still shows Free, Starter and Pro with pilot text. Should P1 touch it, or is the phase 2 plan restructure a separate piece of work?
8. **Phone-first baseline.** Is the owner happy for S2 to start with real 390px captures (via the local dev server and a seeded session) before any visual decisions are final, since this spec could not capture them?
