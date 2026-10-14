# test/contract

## Purpose

Local schema checks for saved examples of paykit's `/api/v1/*` responses.
These tests do not send HTTP requests or prove that the current handlers emit
the saved shape. Route tests cover handler output; database tests cover RLS.

## Contents

- `paykit-api.contract.test.ts` — checkout create/claim/confirm/status, the
  order-ref lookup `GET`, the vendor-config `GET`/`POST`, and the
  booking-status `GET` responses against their sample fixtures.
- `checkout-response.sample.json` — a saved example `POST /api/v1/checkout`
  response.
- `transaction-status.sample.json` — a saved example `GET /api/v1/checkout/{id}`
  response. It and the lookup sample carry `expires_at`.
- `checkout-lookup.sample.json` — a saved example
  `GET /api/v1/checkout?order_ref=` response.
- `vendor-config.sample.json` — a saved example vendor-config response.
- `booking-status.sample.json` — a saved example
  `GET /api/v1/bookings/{booking_id}` response.
- `payment-status-callback.sample.json` — a saved example of the body paykit
  posts to a calling kit's `callback_url`. This one is outbound: it is what
  paykit sends, not what an `/api/v1/*` route answers.
- `checkout-evidence.sample.json` — a saved example
  `GET /api/v1/checkout/{id}/evidence` response.
- `merqo-metrics.contract.test.ts` — asserts `computePaykitMetrics`'s output
  satisfies merqo hub's own `metricsPayloadSchema` (hand-copied here since
  cross-repo runtime imports aren't available — this checks the saved contract, and cannot automatically catch
  drift between the two).

## Parent

See the repo root [README.md](../../README.md) for the full layout.
