# list

Shared list-page pieces used by the ledger, bookings and admin pages.

- `list-error.tsx` — `ListError({ retryHref, message? })`, the `role="alert"` failed-read card with a Try again link.
- `url-pager.tsx` — `UrlPager({ page, pageCount, href, label? })`, a server-rendered pager of real anchors (`rel=prev/next`, 44px targets); renders nothing for one page.
- `phone-row.tsx` — `PhoneList({ label })` (`sm:hidden` list) and `PhoneRow({ title, badge, secondary })`, a two-line row whose button (`aria-expanded`, 44px) reveals its children (the toggle's overlay covers only the summary, so panel actions stay tappable; it is described by the status and secondary line); the phone twin of a `DataTable`.
- `filter-classes.ts` — `FILTER_SELECT_CLASS`, the native select style matching the `Input` focus ring.

## Parent

[components](../README.md)
