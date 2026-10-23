# inquire/[publicId]

## Purpose

`/inquire/{public_id}`: where a client asks a vendor about booking them. The
`public_id` is a random 16-hex value from `inquiry_forms`, so the URL never
shows the vendor id. An unknown id and a form the vendor turned off both
answer 404. The route carries `noindex` and `no-referrer` (metadata and the
`next.config.ts` header rule).

## Contents

- `page.tsx`: reads the enabled form with `loadPublicForm` and renders
  `InquiryForm` with the business name, the vendor's terms (if set) and the
  render time from `formRenderedAt()`.
- `inquiry-form.tsx`: client form: name, phone, optional event date and a
  message, the terms tick box (only when the vendor set terms) and
  `@merqo/ui`'s `DataCollectionNotice`. It has no marketing consent box.
  Also renders the hidden `started_at` and the off-screen `website`
  honeypot.
- `actions.ts`: `submitInquiryAction(publicId, prev, formData)`. In order: a
  malformed id is refused; a filled honeypot or a submit under
  `MIN_FILL_MS` (3 s) after render answers "sent" and stores nothing; Zod
  validation; `inquiryAllowed` (5 per address per 10 minutes, then 30 per
  form per hour); the form is read again, so turning it off takes effect at
  once; `submitInquiry` stores it and alerts the vendor.

## Verification

`actions.test.ts` covers each refusal and the bot paths. `inquiry-form.dom.test.tsx`
covers the notice wording, the terms box and the hidden fields.
`page.dom.test.tsx` covers the 404 and the noindex metadata.

## Parent

[inquire](../README.md)
