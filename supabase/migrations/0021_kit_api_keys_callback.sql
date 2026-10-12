-- Optional outbound callback for a calling kit, beside the inbound bearer
-- secret it already has. secret_hash verifies a secret the kit presents to
-- paykit, so it only ever needs comparing. callback_secret is a secret paykit
-- presents to the kit's own callback route, so paykit has to be able to read
-- it back: it is stored as given. The table stays service-role only (RLS on
-- with no policy, see 0001), so anon and authenticated can read neither
-- column.
--
-- Both are nullable. A kit with either one unset gets no callback.
-- callback_url is the kit's full endpoint URL and must be https.
alter table paykit.kit_api_keys
  add column callback_url text,
  add column callback_secret text;
