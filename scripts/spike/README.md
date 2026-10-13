# spike

## Purpose

Throwaway probes that answer a spec's open questions against a sandbox. Nothing
here is imported by the app, and this folder lives on a spike branch that is
not merged.

## Contents

- `hitpay-sandbox.mjs` — phase P6.1 of
  `docs/superpowers/specs/2026-10-13-bank-auto-detect-design.md`. Talks to the
  HitPay **sandbox** only (it refuses any other host) with a sandbox key the
  owner sets in their own shell. It installs nothing and uses no SDK.

## Running it

Set the two values in your shell. Do not put them in a file in this repo.

```bash
export HITPAY_SANDBOX_API_KEY=...   # sandbox dashboard, API keys
export HITPAY_WEBHOOK_SALT=...      # the sandbox webhook endpoint's salt
```

1. `node scripts/spike/hitpay-sandbox.mjs listen 8787`, expose the port with a
   tunnel, and register that URL in the sandbox dashboard as a webhook endpoint
   for `payment_request.completed`.
2. `node scripts/spike/hitpay-sandbox.mjs create 6.00` and again with an expiry,
   `create 6.00 30`.
3. Pay it at the printed checkout URL.
4. `node scripts/spike/hitpay-sandbox.mjs status <id>`.

## What to write down

Each line closes an item in the spec's "Not verified" list.

| Question                                                                | Where the answer shows                                                                         |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Is `expiry_date` honoured on a QR request?                              | `create` with minutes: "expiry_date sent / returned", "qr_code_expiry", "expiry inside the QR" |
| How long does a QR last with no expiry sent?                            | `create` without minutes: "expiry inside the QR" against "created_at"                          |
| Whose name and reference does the QR carry?                             | `create`: "payee name", "bill reference"                                                       |
| Does `payment_request.completed` fire for an embedded QR, and how fast? | `listen`: arrival time against when you paid                                                   |
| Does the payload carry `reference_number`, `amount`, `status`?          | `listen`: "id / status / amount / reference_number"                                            |
| Is the signature over the raw bytes, not re-serialised JSON?            | `listen`: the two signature lines                                                              |
| Retry policy                                                            | Register the URL with `?fail` on the end; count "delivery number" and the gaps                 |
| Does reading it back agree with the webhook?                            | `status` after paying                                                                          |
| Can a paid QR be paid twice?                                            | Pay the same checkout URL again                                                                |

Not answered by this probe: OAuth scopes, payout timing, sole-proprietor
eligibility, and what a real bank app shows the payer. Those need HitPay's
dashboard, their support, or a live payment.

## Parent

[scripts](../README.md)
