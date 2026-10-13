# Bank Auto Detect, in paykit Only: Design

Date: 2026-10-13. Status: draft for the owner's review. No decision below has
been made. No code, migration or dependency has changed in any repo.

This is phase P6 of the paykit and printkit separation. The parent spec is in
the qkit repo:
`docs/superpowers/specs/2026-10-10-paykit-printkit-separation-design.md`,
section "P6". It says P6 "gets its own spec in the paykit repo". This is that
spec.

## What was asked

The owner, 2026-10-09: "the bank auto detect should be under paykit instead of
qkit right?" The parent spec answered where it goes. It left one question
open: what the signal is. This document answers that, and designs the rest.

Intended outcome: when money arrives for a checkout, paykit knows without a
person looking, moves the transaction to `confirmed`, and tells the kit that
owns the order. A vendor who does nothing still gets paid orders numbered and
printed. A vendor who wants to confirm by hand still can.

## What the parent spec fixes

These are not reopened here.

- Built behind paykit's `PaymentProvider` seam or beside it, never in qkit.
- Findings go to `paykit.payment_evidence` under their own `kind`.
- When paykit is sure, it confirms the transaction itself and fires the P2
  payment-status callback. qkit's handler numbers, notifies and mirrors.
- The vendor's "Confirm payment received" button stays.
- Prerequisites: the owner amends paykit's no-auto-verify rule; checkouts
  carry an `expires_at` that qkit sets to its 30 minute window; a payment that
  matches nothing is recorded for the vendor, not dropped.

## How the audit was done

Read on 2026-10-13 at paykit `42e25b0` (`origin/main`) and qkit `098f052`
(`origin/main`). `paykit #132` (P3) merged while this was being written; the
status below is as of 21:30 SGT. `AGENTS.md` was read in paykit. paykit has no
`docs/CONSTITUTION.md`; its `AGENTS.md` "Rules (always)" section is the
equivalent. Merged and open PRs were listed with `gh pr list` on
`merqo-io/paykit` and `merqo-io/qkit`.

The provider research was done on 2026-10-13 from public web pages only. No
sandbox account was opened and no provider or bank was contacted. Every
provider fact below carries a source. Anything that could not be confirmed
from a primary source is marked **not verified** and is collected in
"Not verified" near the end. Fees and terms are what the provider published on
that date and can change.

This document states facts, costs and trade-offs. It is not financial, legal
or regulatory advice, and the regulatory notes in it are not a legal opinion.

## Where the separation stands

| Phase | paykit                                                 | qkit                  | P6 relies on it for               |
| ----- | ------------------------------------------------------ | --------------------- | --------------------------------- |
| P1    | Merged, `paykit #126` (lookup by `order_ref`)          | Merged, `qkit #215`   | qkit's read-back after a callback |
| P2    | Merged, `paykit #130` (callback, migration `0021`)     | Merged, `qkit #223`   | Telling qkit about a confirm      |
| P3    | Merged, `paykit #132` (`payment_evidence`, `0022`)     | **Open**, `qkit #225` | The evidence table                |
| P4    | Merged, `paykit #131` (`return_to` on the config page) | **Open**, `qkit #224` | Nothing                           |
| P5    | Not started                                            | Not started           | Nothing, but see "Reconcile"      |

What exists in paykit today that P6 uses:

- `src/lib/kit-callback.ts`: `schedulePaymentStatusCallback(tx)`. It targets
  the transaction's own `kit_slug`, not the caller, so a change paykit makes
  by itself already reaches the right kit. Its own comment says so.
- qkit `src/app/api/paykit/payment-status/route.ts`: trusts only `order_ref`,
  reads the status back from paykit, and leaves a cancelled order unchanged.
- `src/lib/payments/provider.ts`: the `PaymentProvider` interface with
  `createCheckout` and a `getStatus` that nothing calls yet. One provider,
  `direct`, chosen by the `PAYKIT_PROVIDER` environment variable for the whole
  deployment.
- `src/lib/tx-state.ts`: `confirmTransition` already allows `pending` to
  `confirmed` and is a no-op on `confirmed`.
- The confirm route writes with `.in("status", ["pending", "claimed"])`, so a
  second writer cannot confirm twice.

- `paykit.payment_evidence` (migration `0022`, merged today). Migrations are
  applied by the owner by hand; whether `0022` is applied to the live
  database was not checked. Its `kind` check allows only `'screenshot'`, and
  it requires a `transaction_id`, so it cannot hold a payment that matched
  nothing. P6 widens the first and works around the second.

What does not exist:

- `transactions.expires_at`, or any void or expiry (parent spec, Problem 3).
- Any inbound webhook from outside the Merqo family. `docs/DEPLOY.md` says
  the direct provider has none.
- Any scheduled job. `AGENTS.md`: "no cron/notification infra exists in this
  repo".
- A per-vendor provider. The seam picks one provider per deployment.

Three facts from the code that shape the design:

1. **qkit's `order_ref` is the order's UUID (36 characters), and the PayNow
   builder cuts the reference to 25** (`args.reference.slice(0, 25)` in
   `src/lib/payments/paynow.ts`). A bank that passes the QR's reference
   through will pass the first 25 characters, not the `order_ref` paykit
   stored.
2. **qkit's 30 minute window runs from the order's `created_at`**, not from
   when the checkout was created, and its sweep only cancels orders with
   `source = 'qr'` (`sweepAbandonedPayments`, `ABANDONED_PAYMENT_MS`). A
   walk-up order left on "Collect later" is never abandoned by a timer.
3. **`vendor_payment_config.verification_method` is writable by the vendor's
   own session.** The column grant includes it; only the Zod schema limits it
   to `'manual'`. A column a vendor can write through PostgREST cannot be what
   turns detection on.

## The signal: what was researched

The question: for a Singapore vendor taking PayNow, with no bank partnership,
what tells paykit that a specific payment arrived?

One distinction decides most of it, so it is stated first.

**Reading a vendor's own bank feed and using a gateway are different
products.** With a bank feed, the customer pays the vendor's bank account
directly, exactly as today, and paykit only learns about it. With a gateway,
the customer pays the gateway. The gateway holds the money, takes a fee, and
pays the vendor out later. The vendor signs a merchant agreement with the
gateway and passes its identity checks. The name the customer sees in their
bank app can be the gateway's, not the stall's. In neither case does paykit
hold money, but only in the first does nobody new hold it.

### Option A. A gateway that issues a dynamic PayNow QR and sends a webhook

The vendor opens their own account with a licensed gateway. paykit asks the
gateway for a PayNow QR for each checkout and the gateway tells paykit when it
is paid.

|                                       | HitPay                                                                                                                                                                            | Stripe                                                                                      | Xendit                                                                          | StraitsX                                                    |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Vendor signs up for                   | Own HitPay account with business verification. Sole proprietors are accepted per HitPay's sign-up guide; the Singapore requirements page is written for ACRA-registered entities. | Own Stripe account in Singapore.                                                            | Own Xendit account; ACRA profile, director ID, corporate bank account, website. | StraitsX business account. Requirements not published.      |
| PayNow fee                            | 0.9% (minimum S$0.20) below S$100; 0.65% + S$0.30 at S$100 and above. No monthly or setup fee.                                                                                    | 1.3%.                                                                                       | 1.30% + S$0.30. US$15 one-time review fee per sub-account.                      | Not published.                                              |
| On a S$6.00 order                     | S$0.20                                                                                                                                                                            | S$0.08                                                                                      | S$0.38                                                                          | unknown                                                     |
| On a S$40.00 order                    | S$0.36                                                                                                                                                                            | S$0.52                                                                                      | S$0.82                                                                          | unknown                                                     |
| QR                                    | `POST /v1/payment-requests` with `generate_qr`; returns a raw PayNow payload string.                                                                                              | PaymentIntent; QR in `next_action`. Valid 1 hour, fixed.                                    | Dynamic QR.                                                                     | Dynamic QR, expiry set by caller, 5 minutes to 30 days.     |
| Reference carried to the notification | Yes. Caller sets `reference_number`; the `payment_request.completed` payload returns it with `id`, `amount`, `status`.                                                            | Yes, by PaymentIntent id and metadata. The payer's bank shows a Stripe-generated reference. | Not verified.                                                                   | Not verified.                                               |
| Latency                               | "Instant" per docs. Not measured.                                                                                                                                                 | "Instantly" per docs. Not measured.                                                         | "Instantly" per marketing.                                                      | Not stated.                                                 |
| Webhook authenticity                  | `Hitpay-Signature`: HMAC-SHA256 of the raw body with that endpoint's salt.                                                                                                        | Signed (`Stripe-Signature`).                                                                | Not verified.                                                                   | Not verified; retried up to 20 times at 5 minute intervals. |
| Who holds the money                   | HitPay. Funds go to the HitPay wallet, then a payout.                                                                                                                             | Stripe. Available T+1, then the payout schedule.                                            | Xendit. Payout fee 1.00%, minimum S$1.00, plus S$0.30.                          | StraitsX business account.                                  |
| Payer sees                            | Not verified. HitPay sells showing the business name as an option at 1.5%.                                                                                                        | "STRIPE PAYMENTS SINGAPORE PTE. LTD." Custom descriptors are ignored.                       | Not verified.                                                                   | Not verified.                                               |
| Sandbox                               | Yes.                                                                                                                                                                              | Yes.                                                                                        | Not checked.                                                                    | Yes, with mock PayNow payments.                             |

The two worked fee rows are arithmetic on the published rates, nothing more.
A stall selling S$6.00 items pays 3.3% of each sale to HitPay at the S$0.20
minimum, and 1.3% to Stripe.

Sources, all read 2026-10-13: HitPay
[PayNow method page](https://docs.hitpayapp.com/payment-methods/paynow),
[embedded QR guide](https://docs.hitpayapp.com/apis/guide/embedded-qr-code-payments),
[webhook events](https://docs.hitpayapp.com/apis/guide/events),
[platform APIs](https://docs.hitpayapp.com/apis/guide/platform-apis),
[sign-up guide](https://hitpayapp.com/blog/hitpay-sign-up),
[SG requirements](https://docs.hitpayapp.com/onboarding/requirements-sg).
Stripe [PayNow payments](https://docs.stripe.com/payments/paynow).
Xendit [pricing](https://www.xendit.co/en/pricing/),
[PayNow QR](https://docs.xendit.co/docs/payment-channel-page-push-14).
StraitsX [PayNow FAQs](https://docs.straitsx.com/docs/paynow-faqs),
[payment callbacks](https://docs.straitsx.com/docs/payment-callbacks).

Other gateways seen and not researched further: Omise (a third-party page
lists 1.00% + S$0.15, not verified), Fazz, Rapyd, Airwallex (no PayNow rate
published), 2C2P, FOMO Pay.

What a gateway gives: an exact match. paykit created the payment request, the
webhook names it, the amount is fixed by the gateway, and a paid QR cannot be
paid twice (Stripe states this; HitPay not verified). There is nothing to
guess.

What it costs: a fee on every sale where direct PayNow has none; money that
arrives in the vendor's bank a day or more later instead of at once; a second
account for the vendor to open and keep; and paykit holding a credential for
that account.

Two platform models exist and are **not** proposed: HitPay's Platform account
(paykit takes a commission per transaction) and Stripe Connect destination
charges (paykit is in the payment). Both put paykit inside the payment flow.

### Option B. The vendor's own bank, through the bank's business API

The customer pays the vendor's bank account directly. The bank tells a system
the vendor has authorised.

|                      | DBS                                                                                                                                                                                                                                                                                | OCBC                                                                                        | UOB                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Product              | RAPID "Inward Credit Notification" (ICN): an API message when an inward payment is credited. Can be sent to a third party on the customer's authorised instruction.                                                                                                                | "Real-time credit notification alerts" through OCBC API solutions. Push or poll not stated. | "Credit/Debit Notification API": instant alerts. Whether it covers PayNow collections is not stated. |
| Vendor signs up for  | A DBS corporate account with IDEAL, then RAPID onboarding. Corporate APIs are offered on enquiry, not self-serve.                                                                                                                                                                  | Corporate banking onboarding, through a relationship manager. Not verified.                 | Application through a relationship manager or a contact form.                                        |
| Fees                 | Not published.                                                                                                                                                                                                                                                                     | Not published.                                                                              | Not published.                                                                                       |
| Reference carried    | Yes on the statement: "the reference numbers (entered by the payer or embedded in PayNow QR) will be shown on the bank account statement". A third party's sample ICN payload has `customerReference`, `transactionType: PAYNOW`, and the payer's name. DBS's own schema not seen. | Not verified. An OCBC FAQ says the statement shows "PayNow" as the reference.               | Not verified.                                                                                        |
| Latency              | Under a minute, or under an hour, per a third party.                                                                                                                                                                                                                               | Not stated.                                                                                 | "Instant".                                                                                           |
| Webhook authenticity | Not verified.                                                                                                                                                                                                                                                                      | Not verified.                                                                               | Not verified.                                                                                        |
| Who holds the money  | The vendor's own bank account. Unchanged from today.                                                                                                                                                                                                                               | Same.                                                                                       | Same.                                                                                                |
| Onboarding time      | Four to six weeks is quoted for DBS Indonesia. Singapore not verified.                                                                                                                                                                                                             | Not stated.                                                                                 | Not stated.                                                                                          |

Sources, read 2026-10-13: DBS
[PayNow Corporate (SME)](https://www.dbs.com.sg/sme/paynow),
[RAPID](https://www.dbs.com.sg/corporate/solutions/rapid/remittance),
[CollectSmart's DBS integration page](https://www.collectsmart.com/dbs-integration.html)
(third party, quotes DBS's ICN description),
[Acme transaction notifications](https://docs.tryacme.com/guides/transaction-notifications)
(third party, sample payload).
OCBC [transaction banking](https://www.ocbc.com/business-banking/corporates/transaction-banking),
[PayNow Corporate FAQ](https://www.ocbc.com/assets/pdf/paynow/faq_paynow_corporate_qr.pdf).
UOB [API services](https://www.uob.com.sg/business/digital/uob-api-services.page).

This is the option the phrase "bank auto detect" describes, and it is the only
one where money keeps going straight to the vendor at no fee. It is not
reachable for paykit's vendors today:

- PayNow Corporate is "only available for entities incorporated in Singapore"
  with a UEN. A vendor taking PayNow on a personal mobile number has no
  business API at all.
- Each bank is a separate relationship, contract and integration, arranged
  through a relationship manager. None is self-serve, and none publishes a
  price or a specification.
- The contract is between the bank and each vendor, not paykit. A stall would
  have to ask its bank for corporate API access so paykit could listen.

The earlier paykit specs said "no bank partnership exists". That is still
true, and the research found no route around it.

### Option C. The bank's merchant app

- **OCBC OneCollect**: real-time alerts, but inside the app only. No API or
  webhook is documented.
  ([OCBC OneCollect](https://www.ocbc.com/business-banking/smes/business-tools/onecollect))
- **DBS MAX**: the SME page lists "PayNow QR checkout via MAX API" with
  "Contact us for more details" and 0.25% for PayNow QR. What the API does,
  and whether it notifies, is not published.
  ([DBS MAX](https://www.dbs.com.sg/sme/max))

DBS MAX is worth one enquiry by the owner: it is aimed at small merchants and
its listed PayNow fee is lower than any gateway's. Nothing can be designed on
it until DBS answers.

### Option D. The bank's email alert, forwarded by the vendor

Banks email the account holder when a PayNow payment arrives. DBS: "all
incoming PayNow transaction alerts will only be sent to your email address".
OCBC and UOB send email alerts too. The vendor would set their mailbox to
forward those alerts to an address paykit gives them, and paykit would read
the amount and time.

Sources, read 2026-10-13: DBS
[PayNow (personal)](https://www.dbs.com.sg/personal/deposits/pay-with-ease/paynow),
OCBC [push notification help](https://www.ocbc.com/personal-banking/help-and-support/digital-banking/mobilepush),
UOB [changes to SMS alerts](https://www.uob.com.sg/personal/digital-banking/pib/changes-to-sms-alerts.page).

For: no partnership, no fee, money stays with the vendor's bank, and it works
for a personal mobile-number PayNow, which no other option does.

Against, and these are serious:

- **Whether the alert carries the QR's reference is not verified.** No sample
  alert was found. Without the reference, the only match is amount and time,
  and a stall selling the same S$6.00 dish all lunch has many open checkouts
  at the same amount.
- **An email is not a bank message.** paykit would be trusting a forwarded
  email. Checking the bank's DKIM signature on the original helps; whether it
  survives each mail provider's forwarding is not verified.
- The banks change alert wording without notice. A parser per bank, kept
  working by hand.
- paykit would receive payers' names. That is personal data paykit does not
  hold today.
- It needs an inbound email service, which this repo does not have.

### Option E. Things ruled out

- **Screenshot reading** (P3). Already built as a hint. A screenshot can be
  edited, so it never confirms anything. Unchanged by P6.
- **Account aggregators that log in as the vendor**, or any design where
  paykit stores a vendor's bank login. Ruled out on principle, not on
  research: it puts a vendor's whole bank account behind paykit's database.
- **SGFinDex.** A consent-based routing layer for individuals' own financial
  planning. No source showed third-party or business-account access. Not
  verified further.

### Summary

| Option          | Reachable now, no partnership | Works for personal PayNow              | Fee to the vendor      | Money goes to                | Match is exact                             |
| --------------- | ----------------------------- | -------------------------------------- | ---------------------- | ---------------------------- | ------------------------------------------ |
| A. Gateway      | Yes                           | No, the vendor needs a gateway account | Yes, per sale          | The gateway, then the vendor | Yes                                        |
| B. Bank API     | No                            | No                                     | Not published          | The vendor                   | Likely, not verified                       |
| C. Merchant app | Unknown                       | No                                     | 0.25% listed (DBS MAX) | The vendor                   | Unknown                                    |
| D. Email alert  | Yes                           | Yes                                    | None                   | The vendor                   | No, unless the alert carries the reference |

**There is no signal today that is reachable, free, keeps money going straight
to the vendor, and is exact.** Every option gives up at least one. That is the
finding the owner should weigh before anything else in this document.

## Recommendation

1. **Build the detection core so the signal is a plug.** Matching, the ledger
   of payments seen, expiry, the review list and the confirm step do not
   depend on which signal feeds them.
2. **First signal: the vendor's own gateway account, HitPay first, opt-in per
   vendor, off by default.** It is the only option whose reference,
   authenticity and API were confirmed from the provider's own documentation,
   it is self-serve, and it has a sandbox. Direct PayNow with manual confirm
   stays the default and stays free. A vendor chooses the gateway knowing it
   has a fee and a payout delay; paykit says both on the screen where they
   choose.
3. **Second signal, only after a test by the owner: the email alert (D), as a
   hint that never confirms by itself** unless the test shows the alert
   carries the QR's reference.
4. **Bank API (B) and DBS MAX (C): not built.** The owner may ask DBS about
   MAX API and RAPID ICN. If either becomes reachable it plugs into the same
   core as another source.
5. **The fallback, always:** manual confirm, with the P3 screenshot hint. It
   is the path for every vendor who does not opt in, and for every vendor who
   did when the signal is late, wrong or down.

HitPay over Stripe for the first build: HitPay's request returns a raw PayNow
payload, which fits paykit's existing `{ type: "qr", payload }` view with no
change to any kit, and the caller's own `reference_number` comes back in the
webhook. Stripe is cheaper on small sales and is the provider the owner is
already registering with for merqo's own billing, so it is the natural second
provider. The seam makes that a second implementation, not a redesign. Which
provider a vendor should use is the vendor's choice and this document does not
make it for them.

## Decisions for the owner

**Decision 1. Which signal is built first?**

- **A (recommended): the vendor's own gateway account, HitPay first.** Exact
  match, verified documentation, self-serve. Cost: it is a different product
  from today's. A fee per sale, money through a third party, a second account
  per vendor. It will suit some vendors and not others.
- B: the email alert first. Free and reaches every vendor, but it may only
  ever be a hint, and it needs an inbound email service and a parser per
  bank. Needs the owner's test (see "Phases", P6.1) before it can be judged.
- C: neither yet. Ship only the prerequisites (`expires_at`, which fixes
  Problem 3 by itself) and ask DBS about MAX API and RAPID ICN first.

**Decision 2. Whose gateway account?**

- **A (recommended): the vendor's own.** The vendor signs with the gateway.
  paykit connects to that account and takes nothing from the payment.
- B: a paykit platform account that collects for vendors or takes a
  commission. Not recommended. It changes what paykit is; see "Regulatory
  position".

**Decision 3. When the signal is exact, does paykit confirm, or only tell the
vendor?**

- **A (recommended): start every vendor in "observe", then "confirm".** In
  observe, paykit records what it detected and shows "Payment detected" but
  the vendor still taps confirm. The vendor, or the owner for a pilot, turns
  on confirm once they have seen it be right. The parent spec's end state
  (paykit confirms) is reached, with a step where a wrong match costs nothing.
- B: confirm from the first day.

**Decision 4. Is auto detect part of Pro?**

The 2026-08-15 Pro simplification spec recorded auto-verify as "a future Pro
perk", on top of refund tracking, and noted it could only cover vendors on a
gateway. That still describes it.

- A: Pro only, checked server-side when a vendor connects a gateway.
- B: free. The vendor already pays the gateway per sale.

No recommendation; it is a pricing decision. The design works either way and
gates in one place.

**Decision 5. A checkout with no `expires_at`: can a payment still match
it?**

- **A (recommended): yes.** No expiry means the kit that created it does not
  abandon it on a timer: a walk-up order on "Collect later", a booking
  deposit. The migration backfills an expiry on every old qkit transaction
  that is not confirmed, so the stale `pending` rows from Problem 3 can never
  match.
- B: no. Only a checkout with an expiry can be auto-confirmed. Simpler to
  reason about; bookings and walk-ups never auto-confirm.

**The rule change.** See "The `AGENTS.md` amendment" below. It is the owner's
edit and nothing in P6.3 onward starts before it.

## Design

### Shape

```
gateway ──webhook──▶ /api/webhooks/{source}/{endpoint_id}
                        │ 1 verify signature over the raw body
                        │ 2 read the payment back from the gateway
                        ▼
                 apply_detected_payment()        one SQL function, one transaction
                        │ insert into detected_payments   (unique per source event)
                        │ match → confirm → payment_evidence → payment_audit
                        ▼
                 schedulePaymentStatusCallback(tx)        only when status changed
                        ▼
                 qkit /api/paykit/payment-status          unchanged since P2
```

Two things sit beside the `PaymentProvider` seam rather than in it: the
webhook route and the detection core. The seam itself gains what a gateway
needs to issue a QR.

### The provider seam

Today one provider serves the whole deployment. A gateway is per vendor.

- `getProvider()` becomes `getProvider(vendorId)`: it returns the vendor's
  connected gateway provider when a connection is active, else `direct`.
  `PAYKIT_PROVIDER` stays as a deployment-wide override and kill switch:
  set to `direct`, every vendor gets the direct provider and no detection
  runs.
- `createCheckout` returns the view plus an optional `providerRef` (the
  gateway's payment request id). `direct` returns none.
- `getStatus(transactionId)` is finally implemented for the gateway provider:
  it asks the gateway. `direct` keeps returning `null`.
- No provider SDK is added. A gateway is called with `fetch` and its
  responses are parsed with Zod, the way `kit-callback.ts` and qkit's paykit
  client already work.
- `src/lib/payments/paynow.ts` is not touched. It stays the verbatim port.
- `autoVerify()` in `adapter.ts`, the stub that throws, is deleted with its
  test when the real path lands.

**Replay.** `createCheckout` in `src/lib/checkout.ts` renders the view, tries
the insert, and on a duplicate compares the fresh payload with the stored one.
A gateway returns a different QR on every call, so that comparison would
answer 409 on every reload of a pay page. For a gateway vendor the order is
reversed: read the existing transaction for `(kit_slug, order_ref)` first; if
it exists, check vendor and amount and return the stored snapshot without
calling the gateway. Only a new checkout calls the gateway. Two simultaneous
first calls can each create a payment request; one insert wins, the loser
returns the winner's snapshot, and the loser's request is never shown to
anyone and expires unpaid.

**When the gateway is down at checkout.** If the gateway call fails or times
out (5 seconds), paykit issues the direct QR from the vendor's own PayNow
details and records `provider = 'direct'` on that transaction. The customer
can still pay; the vendor confirms by hand. Detection is an addition to a
`paynow` config, never a replacement for it, so the direct details are always
there. A `pointer` config (the vendor's own link or QR image) cannot be
detected and is unaffected.

### Connecting a gateway

A new table holds one connection per vendor. It is service-role only: no RLS
policy grants `authenticated` or `anon` anything, the same as `kit_api_keys`.
The vendor's dashboard reads a summary through a server action, never the
row.

What turns detection on is **an active row in this table**, written only by a
server action after paykit has proved the credential works. It is not
`vendor_payment_config.verification_method`: that column is vendor-writable
(fact 3 above), so it stays reserved and unused, and `'manual'` stays the only
value written.

The credential is the most sensitive thing paykit would hold. It is the key
to the vendor's merchant account.

- Prefer the gateway's OAuth connection over a pasted API key, so the vendor
  can revoke paykit from the gateway's side and no key is typed into paykit.
  HitPay documents an OAuth "Connect Merchant Accounts" path; its scopes and
  whether a read-and-create-only grant exists are **not verified**.
- Stored encrypted at rest, with a key held in the deployment's environment
  and set by the owner. The agent never reads or writes env files.
- Never returned to a browser, never logged, never placed in an error
  message. The dashboard shows "Connected", the account's display name, and
  when the last event arrived.
- paykit calls three gateway operations and no others: create a payment
  request, read one, and (if the gateway needs it) register the webhook.
  **paykit never calls a refund, payout or transfer endpoint.** A refund in
  paykit stays a bookkeeping row; the vendor moves the money in the gateway's
  own dashboard.

### `transactions.expires_at`

- `POST /api/v1/checkout` accepts an optional `expires_at`: an ISO 8601
  timestamp with an offset. It is refused (400) when it is in the past or
  more than 7 days ahead.
- Stored on the transaction at creation. A replay with a different value
  keeps the first; it is not a 409. qkit derives it from the order's
  `created_at`, so a reload sends the same value anyway.
- `GET /api/v1/checkout?order_ref=` and `GET /api/v1/checkout/{id}` return it.
  Additive; `null` for a checkout without one.
- **Expiry gates automatic matching only.** A person can still claim, unclaim
  and confirm an expired transaction through every route that exists today.
  If a vendor is looking at the money in their bank, the clock does not
  overrule them.
- When a gateway is used, the same instant is passed as the payment request's
  own expiry where the gateway supports one, so the customer's bank refuses a
  late scan and the late payment never happens. HitPay's response has a
  `qr_code_expiry` field; the request parameter that sets it is **not
  verified**. Stripe's is fixed at 1 hour and cannot be shortened.

**What qkit sets.** For an order with `source = 'qr'`:
`expires_at = order.created_at + ABANDONED_PAYMENT_MS` (30 minutes). For a
walk-up order: nothing, because qkit never abandons it on a timer. That is the
whole qkit change; see "What qkit changes".

**Backfill.** The migration sets
`expires_at = created_at + interval '30 minutes'` on every existing
transaction with `kit_slug = 'qkit'` that is not `confirmed`. They are all
already past it. This closes Problem 3 for the rows that exist today.

### The ledger: `detected_payments`

`payment_evidence` needs a transaction, so it cannot hold a payment that
matched nothing, and it allows one row per kind, so it cannot hold a second
payment for the same checkout. A separate ledger records every payment the
signal reports, matched or not. `payment_evidence` then gets one row, under
its own `kind`, for the payment that settled a transaction. That is what the
parent spec fixed.

```
paykit.detected_payments
  id                 uuid pk
  vendor_id          uuid not null          from the connection, never the body
  source             text not null          'hitpay' now; 'stripe', 'bank_email' later
  source_event_id    text not null          the gateway's own payment id
  provider_ref       text                   the payment request it paid
  amount_cents       integer not null
  reference          text                   as the source reported it
  paid_at            timestamptz not null   the source's time, not arrival
  received_at        timestamptz not null default now()
  outcome            text not null          see below
  transaction_id     uuid                   the match, or the nearest candidate
  resolved_at        timestamptz
  resolved_by        uuid
  detail             jsonb not null default '{}'
  unique (source, source_event_id)
```

`outcome` is one of:

| Outcome             | Meaning                                                          | Changes a transaction |
| ------------------- | ---------------------------------------------------------------- | --------------------- |
| `confirmed`         | Matched and paykit confirmed it.                                 | Yes                   |
| `observed`          | Matched, vendor is in observe mode; shown as "Payment detected". | No                    |
| `already_confirmed` | Matched a transaction a person had already confirmed.            | No                    |
| `late`              | Matched, but after `expires_at`.                                 | No                    |
| `duplicate`         | A second payment for a transaction that already has one.         | No                    |
| `amount_mismatch`   | Reference matched; amount did not.                               | No                    |
| `ambiguous`         | More than one transaction could be the match.                    | No                    |
| `unmatched`         | Nothing matched.                                                 | No                    |

Every row except `confirmed` and `already_confirmed` appears in the vendor's
"Payments to review" list until the vendor resolves it. Nothing is dropped.

No payer name is stored for a gateway payment. It is not needed to match.

RLS: a vendor reads their own rows (`vendor_id = auth.uid()`); an admin reads
all. Writes are service-role only. No delete for anyone, the same reasoning as
`admin_audit` and `payment_evidence`: this is a record of money.

### Matching rules

Matching is one pure function in `src/lib`, with no I/O, so it sits inside the
mutation-tested surface. It takes one detected payment and the vendor's
candidate transactions and returns an outcome.

**Candidates** are the vendor's own transactions in `pending` or `claimed`.
The vendor comes from the connection the webhook arrived on. A payment can
never match another vendor's transaction, whatever its body says.

**For a gateway source, "sure" means all of these:**

1. The webhook's signature verified against that connection's secret.
2. paykit then read the payment back from the gateway with the vendor's
   credential, and the gateway itself says it is completed. The webhook body
   is treated as a hint, the same rule qkit applies to paykit's callback.
3. `provider_ref` equals the `provider_ref` stored on exactly one candidate
   transaction. This is an exact key match on an id paykit received from the
   gateway when it created the checkout. It is not a search.
4. `amount_cents` equals the transaction's `amount_cents`, and the currency is
   SGD.
5. The transaction has no `expires_at`, or `now()` is before it.
6. The transaction's `provider` is this source.

All six: `confirmed` (or `observed`). Anything less is never a confirm:

- 3 holds, 4 fails: `amount_mismatch`.
- 3 and 4 hold, 5 fails: `late`.
- 3 holds on a transaction already confirmed by this same payment id: a
  replay, absorbed by the unique key before matching runs.
- 3 holds on a transaction already confirmed by a different payment:
  `duplicate`. On one confirmed by a person with no payment recorded:
  `already_confirmed`, and the evidence row is still written.
- 3 holds on nothing: `unmatched`.

For a gateway source `ambiguous` cannot occur, because rule 3 is a unique key.

**Time.** Rule 5 uses paykit's clock at the moment of processing, not the
payment's own timestamp. A payment made at 29:50 whose webhook arrives at
30:05 is `late` and goes to the review list. This is deliberately strict: at
30:00 qkit may already have cancelled the order, and a confirm that arrives
after is exactly the case Problem 3 describes. Passing the expiry to the
gateway keeps this edge small.

**For a reference-based source** (the email alert, or a bank API later),
where there is no `provider_ref`, the rules are different and stricter in
effect:

- The reference is compared after normalising both sides: upper case, letters
  and digits only. The transaction's side is the first 25 characters of
  `order_ref` before normalising, because that is what the QR carried (fact
  1). A UUID cut to 25 characters keeps 22 hexadecimal digits, which is
  unique in practice.
- "Sure" needs the reference to match exactly one candidate, the amount to be
  equal, and the expiry rule to hold.
- **Amount and time alone are never "sure".** If the source carries no
  reference, the best outcome is a hint: when exactly one candidate has that
  amount, the transaction shows "A payment of this amount arrived at 12:03";
  when more than one does, the payment is `ambiguous` and appears in the
  review list with the candidates. Neither confirms.

A paykit-minted short reference in the QR (in place of the truncated UUID) was
considered and left out. It would change the payload of every direct PayNow
QR, which the replay check compares, so checkouts in flight at deploy time
would answer 409. The 25-character prefix is enough.

### Confirming: one function, one transaction

`paykit.apply_detected_payment(...)` is a Postgres function, executable by the
service role only, in the style of `sync_booking_status()`. It does all of
this or none of it:

1. Insert the `detected_payments` row. On a unique violation
   (`source, source_event_id`), return the existing row's outcome and stop.
   **This is the replay guard.** A webhook delivered twice, or replayed by an
   attacker with a valid signature, does nothing the second time.
2. Lock the candidate transaction (`select ... for update`) and apply the
   matching rules.
3. On `confirmed`: `update transactions set status = 'confirmed',
confirmed_at = now(), confirmed_via = 'auto' where id = $1 and status in
('pending', 'claimed')`. The row lock and the status guard together mean a
   vendor tapping "Confirm" at the same instant cannot produce two confirms:
   one writer changes the row, the other finds it confirmed. **This is the
   double-confirm guard**, and it is the same guard the confirm route already
   uses.
4. Insert the `payment_evidence` row (`kind = 'gateway_payment'`,
   `detail = { source, detected_payment_id, paid_at }`). Its
   `unique (transaction_id, kind)` constraint is a second guard: one settling
   payment per transaction.
5. Insert the `payment_audit` row with action `auto_confirmed`.
6. Return the outcome and whether the status changed.

The route then calls `schedulePaymentStatusCallback(tx)` only when the status
changed. The callback is fire-and-forget and qkit reads the status back, so a
lost callback leaves qkit behind, never wrong; the vendor's board catches up
on its next read through P1's lookup.

Because the existing `sync_booking_status()` trigger fires on the status
change, a booking's deposit or balance paid through a gateway moves the
booking forward with no extra work.

`src/lib/tx-state.ts` needs no change. `confirmTransition` already describes
this move. `confirmed_via` records who made it (`'manual'` or `'auto'`); it is
`null` for rows confirmed before P6.

A confirmed transaction is never un-confirmed by a signal. If a gateway later
reports a refund or reversal, paykit records it in `detected_payments.detail`
and shows it to the vendor. It does not move the status back:
`unclaimTransition` makes un-confirming impossible on purpose and P6 keeps
that.

### The webhook route

`POST /api/webhooks/{source}/{endpoint_id}`. The first inbound route in paykit
that is not called by a Merqo kit.

- `endpoint_id` is a random 128-bit value per connection, stored hashed. It
  finds the connection; it is not the authentication. An unknown id answers
  404 after the same work as a known one.
- **Authentication is the signature.** For HitPay: HMAC-SHA256 over the raw
  request bytes with that endpoint's salt, compared in constant time with
  `Hitpay-Signature`. The body is read as bytes before any JSON parsing;
  HitPay's own Node sample re-serialises the body, which would not match. A
  bad or missing signature answers 401 and writes nothing.
- The body is capped at 64 KB and parsed with Zod. A valid signature on a body
  that does not parse answers 400.
- **Then the read-back.** paykit asks the gateway for that payment request
  with the vendor's credential and uses the gateway's answer, not the
  webhook's body, for amount and status. A leaked salt alone therefore cannot
  confirm anything. If the read-back fails, the route answers 503 so the
  gateway retries, and nothing is written. HitPay's retry policy is **not
  verified**, so the design does not depend on it; see "Reconcile".
- **Rate limits**, through the existing `check_rate_limit` function: 60 a
  minute per `endpoint_id`, and 120 a minute per client IP across the route.
  The limiter fails open today, on purpose, for calling kits. Here that is
  acceptable only because the signature and the read-back are the gate. Bad
  signatures are counted in `auth_failures` (migration `0014`) the way bad
  bearer secrets are.
- The route answers 200 for every authenticated event it has handled,
  including replays and events that matched nothing, so a gateway does not
  retry forever. It never echoes anything from the connection.
- The route is excluded from `src/proxy.ts`'s session handling and has no
  CORS headers. It is server-to-server.

**The `/api/v1/*` rule is unchanged.** Every `/api/v1/*` route still verifies
a kit's bearer secret. The webhook is outside `/api/v1` because its caller is
not a kit.

### Reconcile: when the webhook does not arrive

paykit has no scheduled job, so a missed webhook cannot be swept up on a
timer. Instead the gateway is asked at the moments someone is already looking:

- When a status is read for a `pending` or `claimed` gateway transaction older
  than 20 seconds: `GET /api/v1/checkout?order_ref=`,
  `GET /api/v1/checkout/{id}`, and the vendor's transaction page. At most once
  per transaction per 15 seconds.
- Always before a manual confirm of a gateway transaction, so the evidence row
  is written when the money is in fact there.

The check calls the provider's `getStatus`, and a completed payment goes
through the same `apply_detected_payment`. It is the same path, started by a
read instead of a webhook.

After P5, the paykit-hosted pay page polls its own transaction, so reconcile
runs while the customer waits. Before P5, qkit's customer page reads qkit's
own mirror, so reconcile depends on the vendor's board or dashboard. P6 does
not need P5, but it is better with it.

A scheduled sweep is out of scope. If one is added later it calls the same
function.

### What the vendor sees

Copy below is indicative; it passes the no-em-dash lint gate.

**Payment setup page** (`dashboard/config`), for a `paynow` config only, a new
section, off by default:

> **Detect payments automatically**
> Today you check your bank and tap Confirm. With a HitPay account, paykit
> can tell when a customer has paid.
> This changes how you are paid: customers pay HitPay, HitPay charges a fee on
> each payment, and HitPay pays you out later. Your PayNow details stay on
> file and are used if HitPay cannot be reached.
> [See HitPay's current fees] [Connect HitPay]

The fee is linked, not quoted, so paykit never shows a stale number. Once
connected: the account name, "Last payment detected 2 minutes ago", the mode
("Show me detected payments" or "Confirm them for me"), and "Disconnect".

**Transactions.** A confirmed row says how: "Confirmed by you" or "Confirmed
automatically, HitPay". In observe mode a matched row says "Payment detected.
Confirm?".

**Payments to review.** A list, with a count badge in the dashboard nav, of
every detected payment that did not settle a transaction. For each: amount,
time, the reason in plain words, and what to do.

| Outcome           | Shown as                                   | Actions                                      |
| ----------------- | ------------------------------------------ | -------------------------------------------- |
| `late`            | "Paid after the order's time ran out"      | Confirm the order anyway; Mark as dealt with |
| `duplicate`       | "This order was paid twice"                | Mark as dealt with                           |
| `amount_mismatch` | "Paid S$5.00 for a S$6.00 order"           | Mark as dealt with                           |
| `unmatched`       | "A payment we could not match to an order" | Mark as dealt with                           |
| `ambiguous`       | "Could be one of these orders"             | Pick one; Mark as dealt with                 |

"Confirm the order anyway" and "Pick one" are the ordinary manual confirm on
that transaction, by the vendor's own session. "Mark as dealt with" sets
`resolved_at`. paykit never refunds; a Pro vendor can record a refund row as
today.

**In qkit: nothing new.** An auto-confirmed order turns paid on the board and
on the customer's page through the callback, exactly as a manual confirm does
today.

One gap is accepted and stated: if a vendor cancels an order in qkit before
its expiry and the customer pays afterwards, paykit confirms the transaction
(the money did arrive) and qkit, by its P2 rule, leaves the cancelled order
alone and logs it. The vendor sees a confirmed payment in paykit for an order
that is cancelled in qkit, and refunds by hand. Closing it needs a "void this
checkout" call from qkit on cancel, which is more than the one qkit change
this phase allows. It is listed under "Out of scope" as the natural next
step.

### Failure modes

Manual confirm works in every row of this table. Nothing in P6 is on the path
of the claim, unclaim or confirm routes except the pre-confirm reconcile,
which is best effort and cannot block the confirm.

| Failure                                                       | What happens                                                                                                                                                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gateway API down at checkout                                  | Direct QR is issued; vendor confirms by hand.                                                                                                                                                           |
| Webhook never arrives                                         | Reconcile on the next read. Otherwise the transaction stays `pending` or `claimed` and the vendor confirms by hand.                                                                                     |
| Webhook arrives twice, or is replayed                         | Unique key; second one is a no-op 200.                                                                                                                                                                  |
| Webhook forged without the salt                               | 401, nothing written, counted.                                                                                                                                                                          |
| Webhook forged with a leaked salt                             | The read-back asks the gateway, which does not know the payment. Nothing written.                                                                                                                       |
| Read-back fails                                               | 503 to the gateway, nothing written, reconcile later.                                                                                                                                                   |
| Vendor's credential revoked or expired                        | Read-back fails with 401 from the gateway: the connection is marked `needs_attention`, new checkouts use the direct QR, the dashboard says "Reconnect HitPay".                                          |
| paykit's callback to qkit is lost                             | qkit is behind, not wrong. It catches up on its next lookup.                                                                                                                                            |
| Vendor and signal confirm at once                             | Row lock and status guard: one confirm, one audit row for whoever won, evidence still recorded.                                                                                                         |
| Signal is wrong (confirms something unpaid)                   | For a gateway this needs the gateway itself to report a completed payment for paykit's own payment request at the right amount. Observe mode exists so each vendor sees it be right before trusting it. |
| No signal for a vendor while checkouts are being paid by hand | A banner: "Automatic detection may not be working. Confirm payments by hand." Shown when 3 gateway checkouts in a row were confirmed manually with no detected payment.                                 |
| Something is badly wrong                                      | `PAYKIT_PROVIDER=direct` on the deployment turns every vendor back to direct QR and stops new detection. Webhooks for existing checkouts are still recorded but do not confirm.                         |

## Regulatory position

Stated plainly, and not as legal advice.

- **paykit today**: renders a QR; the customer's bank pays the vendor's bank.
  paykit is not in the payment.
- **paykit with Option B or D** (bank API, email alert): the same. paykit
  reads a report about the vendor's own account.
- **paykit with Option A, vendor's own account** (recommended): the gateway
  accepts and processes the payment under its own licence and its own
  agreement with the vendor. paykit is software the vendor points at their
  own gateway account. paykit takes nothing from the payment.
- **paykit as a platform** (Decision 2B): paykit would contract with vendors
  about accepting their payments and could take a share. That is a different
  position.

Singapore's Payment Services Act lists "merchant acquisition service" as a
regulated payment service. MAS's FAQ describes it as an entity entering "into
a contract with a merchant to accept and process payment transactions, which
results in a transfer of money to the merchant", and the Act's definition
applies "regardless of whether the service provider comes into possession of
the money". So **not holding funds is not, by itself, what keeps a service
outside the Act.** What paykit contracts to do for the vendor matters.
(Sources, read 2026-10-13:
[MAS licensing FAQs](https://www.mas.gov.sg/contact-us/faqs/payments-faqs/payments-service-licensing-faqs);
[Payment Services Act 2019](https://sso.agc.gov.sg/act/psa2019). The Act's
First Schedule, including its list of excluded services, could not be
retrieved and was **not read**.)

The earlier tap-to-pay spec treated HitPay's licence as resolving this "in
principle" and said the specific flow still had to be confirmed. This spec
does not close that either. **Before P6.3 ships to a real vendor, the owner
should have someone qualified confirm that connecting a vendor's own gateway
account, with no commission and no paykit merchant account, leaves paykit
outside the Act**, and whether paykit's terms need to say so. The design
keeps to the conservative side of every line it can see: vendor's own
account, no commission, no payouts, no refunds through the gateway, no
platform account.

Also to settle before launch: paykit's terms and privacy notice should cover
holding a gateway credential, and the gateway's own terms on third-party
access to a merchant account were **not read**.

## The `AGENTS.md` amendment

`AGENTS.md` is a protected file. This is a draft for the owner to apply; this
PR does not touch it. P6.2 (`expires_at`) needs no amendment. P6.3 onward
does.

**Rules (always). Replace this bullet:**

> - paykit never touches funds. Do not add a payment-provider SDK, a webhook
>   that moves money, or a real auto-verify integration.

**with:**

> - paykit never holds, routes or initiates a movement of funds. Money goes
>   from the customer's bank to the vendor's own bank account, or to a
>   licensed payment provider the vendor holds their own merchant account
>   with. Do not add: a payment-provider SDK (call providers over HTTP and
>   validate with Zod); a paykit-owned merchant or platform account that
>   collects for vendors; a commission or fee taken from a payment; a payout,
>   transfer or refund executed through a provider; or storage of a vendor's
>   bank login.
> - paykit may detect a payment and confirm a transaction from it only as
>   `docs/superpowers/specs/2026-10-13-bank-auto-detect-design.md` sets out:
>   the signal is authenticated and then read back from its source; it is
>   matched by that spec's rules and confirms only on an exact match; every
>   payment seen is recorded in `detected_payments`, matched or not; the
>   settling payment is recorded in `payment_evidence`; and the manual
>   claim, unclaim and confirm paths keep working with detection off or
>   down. Detection is on for a vendor only through an active
>   `vendor_gateway_connections` row, written by the service role.
>   `vendor_payment_config.verification_method` stays `'manual'`: it is
>   vendor-writable and must never carry that authority.
> - The inbound provider webhook (`/api/webhooks/*`) is the one route family
>   that is neither session-guarded nor kit-authenticated. It verifies the
>   provider's signature over the raw body before reading anything, and takes
>   the vendor from the connection, never from the body.

**"What paykit is". Replace** "paykit never touches funds — it renders a QR
the customer scans in their own bank app and tracks a status a human
confirms." **with:**

> paykit never holds or moves funds. It renders a QR the customer scans in
> their own bank app and tracks a status. A person confirms it, or, for a
> vendor who has connected their own payment provider account, paykit
> confirms it when that provider reports the payment (the 2026-10-13 bank
> auto detect spec).

**Data model.** The `verification_method` sentence stays true as written. Add
entries for `detected_payments` and `vendor_gateway_connections`, and
`expires_at`, `provider`, `provider_ref`, `confirmed_via` on `transactions`,
when the phase that creates each one ships. Those are ordinary
schema-follows-migration updates, proposed with each PR.

`docs/DEPLOY.md` says the direct provider "has no payment-provider webhook".
That stays true of the direct provider; the P6.3 PR adds the webhook's setup
beside it.

## Phases

One PR per repo per phase. paykit first, additive, merged and deployed; then
qkit. Before starting any phase, check for open PRs on the repos it touches.
Migration `0022` (P3) must be applied before P6.3.

### P6.0. The owner decides

Decisions 1 to 5. The rule amendment. The regulatory confirmation. No code.

### P6.1. Two checks before any build (owner, no merge)

Time-boxed. Their results go back into this spec.

- **HitPay sandbox.** The owner opens a sandbox account. Confirm every HitPay
  item in "Not verified": the expiry parameter, retry policy, what the payer
  sees, OAuth scopes, whether `payment_request.completed` fires for an
  embedded PayNow QR in sandbox, latency, and whether a paid QR refuses a
  second payment. The agent can write the throwaway script against sandbox
  keys the owner supplies in the environment; it never handles a live key.
- **One real alert email** (only if Option D is of interest). The owner scans
  a paykit QR for a small amount to their own account and looks at the alert
  their bank emails: does it contain the first 25 characters of the order
  reference? That one fact decides whether D can ever confirm.

### P6.2. `expires_at`

Needs no rule amendment and no decision. Fixes Problem 3 by itself and is
safe to ship before anything else.

paykit PR: the request field, the column, the backfill, the two read routes
return it. Nothing reads it yet.

qkit PR: see "What qkit changes".

Verified by: paykit contract test (accepts it, refuses past and far-future
values, replay keeps the first, a request without it is unchanged). qkit
action tests and `pnpm test:e2e` against the updated mock.

### P6.3. Detection core and the HitPay provider, observe only

Needs the amendment, P3 applied, and P6.1's sandbox answers.

paykit PR, which may split in two (core, then provider) for size:

- The matcher, pure, in `src/lib`.
- `detected_payments`, `vendor_gateway_connections`,
  `apply_detected_payment()`, the widened `payment_evidence` and
  `payment_audit` checks, the new `transactions` columns.
- The per-vendor provider, the HitPay provider over `fetch`, the replay
  change in `checkout.ts`, the direct fallback.
- The webhook route and the reconcile check.
- The connect and disconnect actions, and the setup section.
- Every connection is in observe mode. `apply_detected_payment` never
  returns `confirmed`. The transactions page shows "Payment detected".

qkit: no change.

Verified by:

- Unit tests on the matcher for every row of the outcome table, including the
  expiry boundary and the 25-character reference rule. It is in the
  mutation-tested surface.
- Route tests for the webhook: no signature, wrong signature, signature over
  re-serialised JSON (must fail), oversized body, unknown endpoint, replay,
  read-back disagreeing with the body, read-back down.
- pgTAP: a vendor cannot read another vendor's `detected_payments`; nobody
  but the service role can read `vendor_gateway_connections`; nobody can
  delete from either; `apply_detected_payment` called twice with the same
  event changes nothing the second time; called against a transaction
  confirmed in the same instant, it produces one confirm.
- Contract test: `/api/v1/*` responses are unchanged apart from the additive
  fields.
- Manual, on a preview, HitPay sandbox, by the owner: connect, create a
  checkout from **TEST · PayNow**, pay it with the sandbox's mock payment,
  see "Payment detected". The agent types no credential.

### P6.4. Confirm mode, and the review list

paykit PR:

- The mode switch on a connection. `apply_detected_payment` may now return
  `confirmed`; the route fires the callback.
- "Payments to review", the nav badge, the resolve actions, the "may not be
  working" banner.
- `autoVerify()` and its test are deleted.

qkit: no change.

Verified by: the P6.3 suites with confirm on. A callback test: one callback
per status change, none on a replay. Manual on a preview with sandbox: pay a
TEST · PayNow order and watch the qkit board turn it paid and number it
without a tap; pay one after its expiry and see it in the review list; pay
with detection disconnected and confirm by hand. Not on TEST · Printing.

A live pilot with one real vendor is the owner's to run and is not part of
any PR.

### P6.5. Later, each its own decision

- Stripe as a second provider.
- The email alert source, hint only, if P6.1's check supports it. It needs an
  inbound email service, which is new infrastructure and its own short spec.
- A bank API or DBS MAX source, if the owner's enquiry opens one.

## Migrations at a glance

Numbers are assigned when each PR is written; `0022` is P3's and P5 may take
more before P6 starts. The full SQL is given to the owner in chat with each
PR, to apply by hand.

| Phase | qkit | paykit                                                                                                                                                                                                                                                                                                                  |
| ----- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P6.2  | none | `transactions.expires_at timestamptz null`; backfill for unconfirmed `qkit` rows                                                                                                                                                                                                                                        |
| P6.3  | none | `transactions`: `provider text not null default 'direct'`, `provider_ref text null`, `confirmed_via text null check in ('manual','auto')`; unique index on `(provider, provider_ref)` where not null; `protect_checkout_snapshot()` extended to make `provider`, `provider_ref` and `expires_at` immutable after insert |
| P6.3  | none | table `vendor_gateway_connections` (vendor, source, encrypted credential, hashed endpoint id, webhook secret, mode, status, last event time); RLS on, no policy, service-role grants only                                                                                                                               |
| P6.3  | none | table `detected_payments` as above; vendor and admin select policies; service-role insert and update; no delete                                                                                                                                                                                                         |
| P6.3  | none | `payment_evidence.kind` check widened to add `'gateway_payment'`, with a shape check for it                                                                                                                                                                                                                             |
| P6.3  | none | `payment_audit.action` check widened to add `'auto_confirmed'`                                                                                                                                                                                                                                                          |
| P6.3  | none | function `apply_detected_payment(...)`, `security definer`, `search_path = ''`, execute revoked from all but the service role                                                                                                                                                                                           |
| P6.4  | none | none (`mode` already allows `'confirm'`)                                                                                                                                                                                                                                                                                |

`src/lib/types.ts` follows each migration, per the existing rule.

qkit needs no migration in any phase.

## What qkit changes

One thing, in P6.2:

- `createCheckout` in `src/lib/paykit/client.ts` takes an optional
  `expiresAt` and sends it as `expires_at`.
- Its two callers pass it: `payment-actions.ts` (the customer pay step) sends
  `order.created_at + ABANDONED_PAYMENT_MS`; `walkup-actions.ts` sends
  nothing.
- `e2e/paykit-mock.ts` accepts the field.

paykit's request schema is a plain `z.object`, which ignores unknown keys, so
a qkit that sends `expires_at` to an older paykit is harmless. The usual order
still applies: paykit's PR first.

Nothing else. qkit does not learn that a provider exists, does not render
anything new, and its callback handler, sweep and board are untouched. When
P6.4 ships, qkit needs no release.

## Not verified

Collected from above. Each should be closed in P6.1 or by the owner before the
phase that depends on it.

HitPay:

- The request parameter that sets a PayNow QR's expiry, and its limits.
- Webhook retry policy and timeout.
- That `payment_request.completed` fires for an embedded PayNow QR, and how
  fast. The events page and the embedded QR page name events slightly
  differently.
- OAuth scopes, and whether a grant limited to creating and reading payment
  requests exists.
- Whether a paid QR refuses a second payment.
- What name the payer's bank app shows.
- Payout timing. A HitPay blog says next business day; the method page says
  only that funds go to the HitPay wallet.
- Whether a sole proprietor or an unregistered individual can open an account.
  Two HitPay pages disagree.
- An in-person PayNow rate of 0.4% (minimum S$0.10) appears on a HitPay
  marketing page and not in its documentation.
- HitPay's terms on a third party operating a merchant's account.

Other gateways: Xendit, StraitsX, Omise, Fazz webhook signing, reference
pass-through and what the payer sees. StraitsX and Omise fees.

Banks: every detail of DBS RAPID ICN, OCBC and UOB credit notification beyond
their marketing pages: eligibility, price, payload, signing, onboarding time.
What DBS MAX API does. Whether any bank's PayNow alert email includes the QR's
reference. Whether a bank's DKIM signature survives a mailbox forward.
Whether a payer can edit the reference a dynamic PayNow QR carries.

Regulatory: the Payment Services Act's First Schedule and its exclusions were
not read. No legal view was taken.

Not measured by anyone here: latency of any signal.

## Out of scope

- Any change to `qkit.place_order`, the sweep, or qkit's callback handler.
- A "void this checkout" call from qkit on cancel. It would close the
  cancelled-then-paid gap and is the natural follow-up.
- A scheduled reconcile job.
- Executing refunds, payouts or transfers through a provider. paykit's
  `refunds` stays a bookkeeping ledger.
- Detecting payments for `pointer` configs.
- Auto-confirming from a screenshot. The P3 amount check stays a hint.
- A paykit platform or commission model.
- Choosing a provider for any vendor.
- Telegram or push alerts for detected payments.

## Working rules for every phase

Feature branch per repo, never `main`. No hook bypass.
`pnpm check && pnpm test` before a phase is called done. RLS stays the
authorization boundary; the service-role client stays server-only; every new
route and action validates with Zod; no secret under `NEXT_PUBLIC_*`. Env
files and `secrets/` are never read or written; the owner sets every key and
connects every account. `AGENTS.md` changes are proposed to the owner, not
written directly. No provider SDK is installed.
