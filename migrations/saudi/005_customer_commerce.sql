-- Saudi isolated commerce schema v005. Requires exact Saudi schema v4.
-- The creation of tables DOES NOT enable real payments or orders.
BEGIN;
SELECT pg_advisory_xact_lock(92370421001);
DO $guard$
DECLARE version_no integer;
BEGIN
 IF to_regclass('public.saudi_market_metadata') IS NULL THEN
  RAISE EXCEPTION 'Saudi market marker is missing';
 END IF;
 SELECT schema_version INTO version_no FROM saudi_market_metadata WHERE market='go-saudi';
 IF version_no NOT IN (4,5) OR (SELECT count(*) FROM saudi_market_metadata)<>1 THEN
  RAISE EXCEPTION 'Saudi v005 requires isolated v4 or v5 database';
 END IF;
 IF to_regclass('public.saudi_vendor_accounts') IS NULL OR
    to_regclass('public.saudi_catalog_submissions') IS NULL THEN
  RAISE EXCEPTION 'Saudi vendor or catalog tables missing';
 END IF;
END $guard$;

CREATE TABLE IF NOT EXISTS saudi_customer_accounts (
 id varchar(64) PRIMARY KEY,
 phone_hash varchar(64) NOT NULL UNIQUE,
 phone_encrypted text NOT NULL,
 created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS saudi_customer_sessions (
 id varchar(64) PRIMARY KEY,
 customer_id varchar(64) NOT NULL REFERENCES saudi_customer_accounts(id) ON DELETE CASCADE,
 token_hash varchar(64) NOT NULL UNIQUE,
 expires_at timestamp NOT NULL,
 revoked_at timestamp,
 created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saudi_customer_sessions_owner
 ON saudi_customer_sessions(customer_id);

CREATE TABLE IF NOT EXISTS saudi_orders (
 id varchar(64) PRIMARY KEY,
 customer_id varchar(64) NOT NULL REFERENCES saudi_customer_accounts(id) ON DELETE RESTRICT,
 vendor_id varchar(64) NOT NULL REFERENCES saudi_vendor_accounts(id) ON DELETE RESTRICT,
 idempotency_key varchar(80) NOT NULL,
 status varchar(32) NOT NULL DEFAULT 'PENDING_PAYMENT'
  CHECK (status IN ('PENDING_PAYMENT','CREATING_INTENT','READY_FOR_PAYMENT','PAID','FAILED','EXPIRED','REFUND_PENDING','REFUNDED','CANCELLED')),
 currency varchar(3) NOT NULL DEFAULT 'SAR' CHECK (currency='SAR'),
 subtotal_halalas integer NOT NULL CHECK (subtotal_halalas BETWEEN 1 AND 100000000),
 payment_intent_id varchar(80) UNIQUE,
 payment_id varchar(80) UNIQUE,
 fulfillment varchar(16) NOT NULL DEFAULT 'PICKUP' CHECK (fulfillment='PICKUP'),
 expires_at timestamp NOT NULL,
 paid_at timestamp,
 created_at timestamp NOT NULL DEFAULT now(),
 CONSTRAINT saudi_order_idempotency UNIQUE(customer_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_saudi_orders_buyer ON saudi_orders(customer_id,created_at);
CREATE INDEX IF NOT EXISTS idx_saudi_orders_vendor ON saudi_orders(vendor_id,created_at);
CREATE INDEX IF NOT EXISTS idx_saudi_orders_status ON saudi_orders(status,expires_at);

CREATE TABLE IF NOT EXISTS saudi_order_lines (
 id varchar(64) PRIMARY KEY,
 order_id varchar(64) NOT NULL REFERENCES saudi_orders(id) ON DELETE CASCADE,
 product_id varchar(64) NOT NULL REFERENCES saudi_catalog_submissions(id) ON DELETE RESTRICT,
 title varchar(120) NOT NULL,
 quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 20),
 unit_halalas integer NOT NULL CHECK (unit_halalas BETWEEN 1 AND 100000000),
 line_halalas integer NOT NULL CHECK (line_halalas BETWEEN 1 AND 100000000)
);
CREATE INDEX IF NOT EXISTS idx_saudi_order_lines_order ON saudi_order_lines(order_id);

CREATE TABLE IF NOT EXISTS saudi_booking_requests (
 id varchar(64) PRIMARY KEY,
 customer_id varchar(64) NOT NULL REFERENCES saudi_customer_accounts(id) ON DELETE RESTRICT,
 vendor_id varchar(64) NOT NULL REFERENCES saudi_vendor_accounts(id) ON DELETE RESTRICT,
 product_id varchar(64) NOT NULL REFERENCES saudi_catalog_submissions(id) ON DELETE RESTRICT,
 requested_slot timestamp NOT NULL,
 status varchar(24) NOT NULL DEFAULT 'REQUESTED'
  CHECK (status IN ('REQUESTED','DECLINED','ACCEPTED','CANCELLED')),
 note varchar(500) NOT NULL DEFAULT '',
 reviewed_at timestamp,
 created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saudi_bookings_buyer ON saudi_booking_requests(customer_id,created_at);
CREATE INDEX IF NOT EXISTS idx_saudi_bookings_vendor ON saudi_booking_requests(vendor_id,created_at);

UPDATE saudi_market_metadata SET schema_version=5
 WHERE market='go-saudi' AND schema_version IN (4,5);
COMMIT;
