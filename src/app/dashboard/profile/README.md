# profile

Vendor account settings. `page.tsx` establishes the vendor session, loads the
shared profile and reads auth metadata defensively before rendering
`profile-form.tsx`. The shared back button receives plain serializable props;
client component references cannot cross directly from this server page.

`actions.ts` validates stall-name and social-link input and calls the
owner-scoped `patch_vendor_profile` RPC. Each write changes only the submitted
field, preserving concurrent edits to the other column. Missing rows are
provisioned atomically; empty social links explicitly clear links.

The client form saves display name, avatar metadata and password through
`supabase.auth.updateUser`. These belong to the shared Supabase account.
It composes shared sections, social-link fields and image uploader from
`@merqo/ui`; `lib/image-upload-adapter.ts` uploads to the supported public
bucket and contains best-effort cleanup. A successful avatar replacement removes
the previous object; returned save errors restore the visible previous avatar
and attempt unused-upload cleanup. Uncertain network outcomes must not be
interpreted as proof that a metadata write did not commit.

`hooks/use-async-action.ts` supplies the per-call pending/error contract.
Action and DOM tests cover validation, field patches, account updates and form
failures; mocked tests do not establish database grants or live shared-session
behavior.

## Tab title

`page.tsx` exports `metadata.title = "Profile"`, which the root layout's `%s | Paykit` template turns into "Profile | Paykit". `src/app/page-titles.test.ts` checks it.

## Parent

[dashboard](../README.md)

`profile-form.tsx` renders its inline errors through a small `FieldError` component.
