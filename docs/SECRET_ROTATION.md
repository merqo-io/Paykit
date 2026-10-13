# paykit — Bearer-Secret Rotation Runbook

Every calling kit (qkit, and any future one) authenticates to paykit's
`/api/v1/*` surface with one bearer secret, stored hashed in
`paykit.kit_api_keys` (one row per `kit_slug`). This is the real
operational process for rotating one — read it before running
`scripts/create-kit-key.mjs` against a kit that's already live.

## The real constraint: today's rotation is a hard cutover, not zero-downtime

`create-kit-key.mjs` creates a new key by default and refuses an existing
`kit_slug`. Explicit `--rotate` updates an existing key immediately. There is no
grace window and no way for the old and new secret to both be valid at
once. The instant you run the script, the calling kit's _currently
deployed_ secret starts failing every request with a 401, until that
kit's own environment variable is updated to the new value and
redeployed.

This is a known, accepted limitation, not an oversight — a real
dual-secret grace window would need a schema change (a second
`previous_secret_hash`/expiry pair, checked as a fallback in
`verifyKitAuth`) that hasn't been built. If rotation frequency or a real
incident ever makes this genuinely painful, that's the fix to build then.

## Before rotating: check `last_used_at`

`kit_api_keys.last_used_at` (migration `0013`) is touched on every
successful `verifyKitAuth` call — it tells you whether the secret you're
about to rotate is actually live traffic right now, not a stale row for
a kit that's no longer calling in.

```sql
select kit_slug, last_used_at from paykit.kit_api_keys order by kit_slug;
```

- **Recently used (minutes/hours ago):** this kit is actively calling
  paykit. Rotating it now will cause real 401s the moment you run the
  script, until the calling kit redeploys with the new secret. Coordinate
  the timing — see below.
- **Never used (`null`) or stale (weeks+):** either the calling kit was
  never actually deployed with this secret, or it's stopped calling
  paykit entirely. Safe to rotate (or delete the row) without expecting
  live disruption — but confirm with whoever owns that kit before
  deleting, in case it's dormant rather than decommissioned.

## Rotation steps

1. **Confirm `last_used_at`** for the target `kit_slug` (above) — know
   whether you're about to interrupt live traffic.
2. **Have the calling kit's new deploy ready first.** Don't run the
   script until you can update and redeploy the calling kit's own secret
   (its `PAYKIT_KIT_SECRET`-equivalent env var) within the same window —
   the gap between the two is real downtime for that kit's checkout flow.
3. **Run the script**:
   ```bash
   node scripts/create-kit-key.mjs <kit_slug> --rotate
   ```
   It prints the new plaintext secret once. Save it immediately — paykit
   never stores or displays it again.
4. **Update and redeploy the calling kit** with the new secret right
   away.
5. **Confirm the cutover worked**: re-check `last_used_at` for that
   `kit_slug` a few minutes later. A fresh timestamp means the calling
   kit picked up the new secret successfully. If it's still stuck at the
   pre-rotation time, the calling kit hasn't redeployed yet, or its new
   secret doesn't match — check `verifyKitAuth`'s failed-auth logs
   (`src/lib/kit-auth.ts`) for `"unknown kit_slug"` or `"secret mismatch"`
   warnings from that kit_slug.

## The callback secret is a different secret

`kit_api_keys.callback_secret` (migration `0021`) is the secret paykit
presents to a calling kit's own callback route. It is unrelated to the bearer
secret above, runs in the other direction, and `create-kit-key.mjs` neither
reads nor writes it, so rotating the bearer secret leaves it alone.

To rotate it, change both sides in this order:

1. Set the new value in the calling kit's environment (for qkit,
   `PAYKIT_CALLBACK_SECRET`) and redeploy it.
2. Update the row:
   ```sql
   update paykit.kit_api_keys
   set callback_secret = '<new value>'
   where kit_slug = '<kit_slug>';
   ```

Between the two steps callbacks are answered 401 and dropped. That is safe:
the callback is a hint and the kit's own actions still write their status.
To stop callbacks to a kit, set `callback_url` to `null`.

## Parent

See [docs/README.md](README.md) for the rest of the docs layout.
