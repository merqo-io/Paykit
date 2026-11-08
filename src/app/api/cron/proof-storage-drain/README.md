# proof-storage-drain

## Purpose

`GET /api/cron/proof-storage-drain` — daily Vercel Cron job that removes payment screenshots from the `paykit-payment-proofs` bucket after their `payment_evidence` row was deleted (retention item X-26). Bearer-secret gated (`cronBearerOk`, `CRON_SECRET`, constant-time); 401 when the secret is unset or wrong. Vercel Cron runs only on Production, so on staging call the route by hand with the secret.

## Contents

- `route.ts`, authenticates, then calls `drainProofDeletions` (`src/lib/proof-storage-cleanup.ts`) with the service-role client and returns `{ removed, failed }`.
- `route.test.ts` — 401 for no, wrong or unset secret; 200 and the drain result for the right one.

## Parent

See the repo root [README.md](../../../../../README.md) for the full layout.
