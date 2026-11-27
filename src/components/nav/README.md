# nav

Dashboard navigation components with no paykit imports, so they can be lifted
into `@merqo/ui` later. They render `NavLinkItem`s (`types.ts`); the paykit
adapter in `src/app/dashboard/dashboard-nav.tsx` builds those from `src/lib/nav.ts`.

- `bottom-tab-bar.tsx` — phone tab bar, fixed to the bottom, safe-area aware, with a count badge and a More trigger. Hidden from `sm` and in print.
- `more-sheet.tsx` — bottom sheet with setup pages and legal links.
- `side-rail.tsx` — left rail from `lg`, with optional per-link anchor ids.

`nav.dom.test.tsx` covers all three.
