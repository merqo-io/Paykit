# db-types

Hand-maintained TypeScript mirror of `supabase/migrations`, split by domain so each file stays under the size limit. Import from `@/lib/types`, which re-exports everything here.

## Contents

- `database.ts`: the `Database` interface (tables, views and RPC signatures) in one file.
- `json.ts`: the `Json` alias used by JSON columns.
- `vendor.ts`: social links, plan, verification method, payment config, prefs, entitlement and legal-check types.
- `payments.ts`: transaction, refund, feedback, payment audit and payment evidence types.
- `bookings.ts`: booking and inquiry types.
- `admin.ts`: admin, admin audit, auth failure and ops event types.