-- When the calling kit gives up on the order a checkout belongs to. Null
-- means the kit sets no time limit (a walk-up order, a booking payment).
-- It gates automatic matching of a detected payment only; a person can
-- claim, unclaim and confirm a transaction whatever this says.
alter table paykit.transactions
  add column expires_at timestamptz;

-- qkit abandons an unpaid QR order 30 minutes after it is placed and has
-- never told paykit. Every qkit transaction that is still unpaid gets the
-- expiry it would have carried, so no stale row can match a later payment.
update paykit.transactions
   set expires_at = created_at + interval '30 minutes'
 where kit_slug = 'qkit'
   and status <> 'confirmed'
   and expires_at is null;
