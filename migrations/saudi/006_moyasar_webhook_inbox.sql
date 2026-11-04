-- Saudi-only schema version 006; durable receipt of Moyasar webhook events.
-- Ingesting a callback MUST NOT mark an order as paid.
BEGIN;
SELECT pg_advisory_xact_lock(92370421001);
DO $guard$
DECLARE v integer;
BEGIN
 IF to_regclass('public.saudi_market_metadata') IS NULL THEN
   RAISE EXCEPTION 'Dedicated Saudi database marker required';
 END IF;
 SELECT schema_version INTO v FROM saudi_market_metadata WHERE market='go-saudi';
 IF v NOT IN (5,6) OR (SELECT count(*) FROM saudi_market_metadata)<>1 THEN
   RAISE EXCEPTION 'Saudi webhook migration requires schema version 5 or 6';
 END IF;
 IF to_regclass('public.saudi_orders') IS NULL THEN
   RAISE EXCEPTION 'Saudi order schema missing';
 END IF;
END $guard$;
CREATE TABLE IF NOT EXISTS saudi_moyasar_webhook_events(
 id varchar(64) PRIMARY KEY,
 event_type varchar(32) NOT NULL CHECK (event_type IN
  ('payment_paid','payment_failed','payment_faild','payment_refunded',
   'payment_voided','payment_authorized','payment_captured','payment_verified')),
 payment_id varchar(80) NOT NULL,
 order_id varchar(64),
 is_live boolean NOT NULL,
 status varchar(24) NOT NULL DEFAULT 'RECEIVED'
  CHECK (status IN ('RECEIVED','REVIEW_REQUIRED','PROCESSED')),
 received_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saudi_moyasar_inbox_status
  ON saudi_moyasar_webhook_events(status,received_at);
CREATE INDEX IF NOT EXISTS idx_saudi_moyasar_inbox_payment
  ON saudi_moyasar_webhook_events(payment_id);
UPDATE saudi_market_metadata SET schema_version=6
 WHERE market='go-saudi' AND schema_version IN (5,6);
COMMIT;
