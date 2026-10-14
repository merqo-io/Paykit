-- The hosted pay page, /pay/{transaction_id}?k=<token>: a calling kit sends
-- its customer there to pay and paykit sends them back afterwards.
--
-- pay_token_hash is the sha256 of a random token that only the customer's
-- link carries. paykit never stores the token, so a read of this table
-- cannot open a pay page. Null means the transaction has no pay page.
--
-- return_url is where the customer goes once the payment is claimed. It is
-- checked against the calling kit's return_origin before it is stored.
-- pay_title is the one line the page shows above the amount.
--
-- A vendor can already read their own transactions (0001), so they can read
-- these three columns on their own rows. Nobody but the service role writes
-- them: authenticated holds select only.
alter table paykit.transactions
  add column pay_token_hash text
    constraint transactions_pay_token_hash_shape
    check (pay_token_hash is null or pay_token_hash ~ '^[0-9a-f]{64}$'),
  add column return_url text
    constraint transactions_return_url_length
    check (return_url is null or length(return_url) between 1 and 2000),
  add column pay_title text
    constraint transactions_pay_title_length
    check (pay_title is null or length(pay_title) between 1 and 120);

-- The origin (scheme, host and port, for example https://qkit.merqo.io) every
-- return_url from this kit must be on. Null means the kit may not use the
-- pay page. The table stays service-role only (RLS on with no policy, 0001).
alter table paykit.kit_api_keys
  add column return_origin text;
