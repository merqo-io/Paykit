# inquiry detail

## Purpose

One inquiry, read under the vendor's RLS session; 404 for a missing row or
another vendor's.

## Contents

- `page.tsx`: the client's phone as a `tel:` link and a WhatsApp link
  (`whatsappLink` in `src/lib/phone-links.ts`), the event date, the message,
  the terms acknowledgment (`TermsSnapshot`) and the actions. An open
  inquiry offers "Convert to booking": the shared `NewBookingDialog`,
  prefilled with the client's name, phone and event date and carrying the
  inquiry id. A converted one links to its booking instead.
- `inquiry-detail-actions.tsx`: "Mark contacted" (new only), "Decline" and
  "Delete" behind a confirm dialog. Delete is how a vendor honours a
  client's request to remove their data.

## Tab title

`page.tsx` exports `metadata.title = "Inquiry"`. `src/app/page-titles.test.ts` checks it.

## Parent

[inquiries](../README.md)
