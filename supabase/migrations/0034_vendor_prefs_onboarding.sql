-- First-run checklist state on Home. Only what cannot be derived from other
-- tables is stored: whether the vendor hid the checklist, and whether they
-- have seen the live QR preview on Payment setup. The other steps (config
-- saved, first confirmed payment) are read from vendor_payment_config and
-- transactions so they cannot drift from reality.
-- The existing vendor_prefs_own policy (0005) already scopes select/insert/
-- update to the owning vendor; no policy or grant changes are needed.
alter table paykit.vendor_prefs
  add column onboarding_dismissed_at timestamptz,
  add column qr_previewed_at timestamptz;
