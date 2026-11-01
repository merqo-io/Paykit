# `GET /api/v1/checkout/{id}`

Returns a transaction's current status to the calling kit, as the shared
`TransactionStatusResponse` (`toStatusResponse` in `src/lib/api-schemas.ts`).
Bearer-secret authenticated (`verifyKitAuth`) with a UUID path-param check.

The lookup filters on the authenticated kit's slug as well as the id, so a
transaction another kit created answers `404`, the same as an unknown id.

## Contents

- `route.ts` - the `GET` handler.
- `route.test.ts` - status, auth, validation, upstream-failure and kit-scoping cases.
- `claim/`, `confirm/`, `unclaim/`, `evidence/` - the lifecycle routes beneath it, each with its own README.
