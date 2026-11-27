# nav

Dashboard navigation components with no paykit imports, so they can be lifted
into `@merqo/ui` later. They render `NavLinkItem`s (`types.ts`); the paykit
adapter in `src/app/dashboard/dashboard-nav.tsx` builds those from `src/lib/nav.ts`.

- `bottom-tab-bar.tsx` — phone tab bar, fixed to the bottom, safe-area aware, with a count badge and a More trigger. Hidden from `lg` and in print. `tab-bar-height.ts` holds the shared tab height and the offset `PageShell` uses to sit above it.
- `more-sheet.tsx` — bottom sheet with setup pages, an optional "Setup guide" row (the caller passes its action) and legal links. Closes itself when the viewport reaches `lg`.
- `side-rail.tsx` — left rail from `lg`.

`nav.dom.test.tsx` covers all three.
