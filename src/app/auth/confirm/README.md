# confirm

## Purpose

Landing page for Supabase auth emails that link to this app's own origin. A GET never consumes the token (email scanners pre-fetch links); only the button's POST verifies it.

## Contents

- `page.tsx`: server component. Reads `token_hash`, `type` and `next` with `readAuthConfirmParams` and renders `AuthConfirmForm`, or `AuthConfirmInvalid` when the link is malformed. It never calls Supabase. Metadata is `noindex` with `referrer: no-referrer` so the token is not leaked.
- `page.dom.test.tsx`: the form for a valid link, the invalid state for bad links, no Supabase call, the metadata.
- `verify/`: the POST route that verifies the token.

## Parent

[app](../../README.md)
