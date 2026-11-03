-- Go Saudi isolated prelaunch database, migration v001.
-- IMPORTANT: Run ONLY in a fresh, dedicated Saudi database. Never in Go Bharat.
BEGIN;
SELECT pg_advisory_xact_lock(92370421001);
DO $guard$
DECLARE
  existing_tables text;
  market_count integer;
  market_ok integer;
BEGIN
  -- A never-migrated DB must be empty. Existing non-Saudi tables are an
  -- absolute failure, even when they do not have standard Go Bharat names.
  IF to_regclass('public.saudi_market_metadata') IS NULL THEN
    SELECT string_agg(tablename, ', ') INTO existing_tables
    FROM pg_tables WHERE schemaname='public';
    IF existing_tables IS NOT NULL THEN
      RAISE EXCEPTION 'Refusing Saudi initial migration: nonempty unmarked database';
    END IF;
  ELSE
    SELECT count(*),count(*) FILTER (WHERE market='go-saudi' AND schema_version IN (1,2,3,4,5))
      INTO market_count,market_ok
    FROM saudi_market_metadata;
    IF market_count<>1 OR market_ok<>1 THEN
      RAISE EXCEPTION 'Refusing Saudi migration: incompatible market marker/version';
    END IF;
    SELECT string_agg(tablename, ', ') INTO existing_tables
    FROM pg_tables WHERE schemaname='public' AND tablename NOT IN (
      'saudi_market_metadata','seller_enquiries','saudi_seller_review_events',
      'saudi_vendor_accounts','saudi_vendor_invites',
      'saudi_vendor_sessions','saudi_vendor_draft_products',
      'saudi_vendor_data_requests','saudi_catalog_submissions',
      'saudi_customer_accounts','saudi_customer_sessions','saudi_orders',
      'saudi_order_lines','saudi_booking_requests'
    );
    IF existing_tables IS NOT NULL THEN
      RAISE EXCEPTION 'Refusing Saudi migration: unexpected public tables detected';
    END IF;
  END IF;
END $guard$;

CREATE TABLE IF NOT EXISTS saudi_market_metadata (
  market varchar(32) PRIMARY KEY,
  schema_version integer NOT NULL,
  deployed_at timestamp NOT NULL DEFAULT now()
);
INSERT INTO saudi_market_metadata (market,schema_version)
 VALUES ('go-saudi',1)
 ON CONFLICT(market) DO NOTHING;

CREATE TABLE IF NOT EXISTS seller_enquiries (
  id varchar(64) PRIMARY KEY,
  business_name varchar(100) NOT NULL,
  city varchar(80) NOT NULL,
  category varchar(30) NOT NULL,
  phone varchar(15) NOT NULL,
  contact_consent boolean NOT NULL DEFAULT false,
  status varchar(24) NOT NULL DEFAULT 'NEW',
  source varchar(30) NOT NULL DEFAULT 'SAUDI_LANDING',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  CONSTRAINT saudi_enquiry_source CHECK (source = 'SAUDI_LANDING'),
  CONSTRAINT saudi_enquiry_status CHECK (status IN ('NEW','CONTACTED','DOCUMENTS_PENDING','UNDER_REVIEW','APPROVED','REJECTED')),
  CONSTRAINT saudi_enquiry_phone CHECK (phone ~ '^[+]9665[0-9]{8}$')
);
CREATE INDEX IF NOT EXISTS idx_seller_enquiries_created ON seller_enquiries(created_at);
CREATE INDEX IF NOT EXISTS idx_seller_enquiries_status ON seller_enquiries(status);
CREATE INDEX IF NOT EXISTS idx_seller_enquiries_phone ON seller_enquiries(phone);

CREATE TABLE IF NOT EXISTS saudi_seller_review_events (
  id varchar(64) PRIMARY KEY,
  enquiry_id varchar(64) NOT NULL REFERENCES seller_enquiries(id) ON DELETE CASCADE,
  from_status varchar(24) NOT NULL,
  to_status varchar(24) NOT NULL,
  reviewer varchar(80) NOT NULL,
  note text NOT NULL DEFAULT '',
  phone_confirmed boolean NOT NULL DEFAULT false,
  business_documents_checked boolean NOT NULL DEFAULT false,
  compliance_reviewed boolean NOT NULL DEFAULT false,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saudi_review_enquiry_created ON saudi_seller_review_events(enquiry_id,created_at);
CREATE TABLE IF NOT EXISTS saudi_vendor_accounts(
 id varchar(64) PRIMARY KEY,
 enquiry_id varchar(64) NOT NULL UNIQUE REFERENCES seller_enquiries(id) ON DELETE CASCADE,
 description text NOT NULL DEFAULT '',
 created_at timestamp DEFAULT now(),
 updated_at timestamp DEFAULT now(),
 CONSTRAINT saudi_store_description_length CHECK (char_length(description) <= 600)
);
CREATE TABLE IF NOT EXISTS saudi_vendor_invites(
 id varchar(64) PRIMARY KEY,
 vendor_id varchar(64) NOT NULL REFERENCES saudi_vendor_accounts(id) ON DELETE CASCADE,
 token_hash varchar(64) NOT NULL UNIQUE,
 expires_at timestamp NOT NULL,
 consumed_at timestamp,
 created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saudi_vendor_invite_vendor ON saudi_vendor_invites(vendor_id);
CREATE TABLE IF NOT EXISTS saudi_vendor_sessions(
 id varchar(64) PRIMARY KEY,
 vendor_id varchar(64) NOT NULL REFERENCES saudi_vendor_accounts(id) ON DELETE CASCADE,
 token_hash varchar(64) NOT NULL UNIQUE,
 expires_at timestamp NOT NULL,
 revoked_at timestamp,
 created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_saudi_vendor_session_vendor ON saudi_vendor_sessions(vendor_id);
CREATE TABLE IF NOT EXISTS saudi_vendor_draft_products(
 id varchar(64) PRIMARY KEY,
 vendor_id varchar(64) NOT NULL REFERENCES saudi_vendor_accounts(id) ON DELETE CASCADE,
 title varchar(120) NOT NULL,
 description text NOT NULL DEFAULT '',
 price_halalas integer NOT NULL,
 stock integer NOT NULL DEFAULT 0,
 status varchar(12) NOT NULL DEFAULT 'DRAFT',
 created_at timestamp DEFAULT now(),
 updated_at timestamp DEFAULT now(),
 CONSTRAINT saudi_product_positive_price CHECK (price_halalas BETWEEN 1 AND 100000000),
 CONSTRAINT saudi_product_stock_range CHECK (stock BETWEEN 0 AND 1000000),
 CONSTRAINT saudi_product_draft_only CHECK (status = 'DRAFT'),
 CONSTRAINT saudi_product_description_length CHECK (char_length(description) <= 1500)
);
CREATE INDEX IF NOT EXISTS idx_saudi_vendor_products ON saudi_vendor_draft_products(vendor_id);
COMMIT;
