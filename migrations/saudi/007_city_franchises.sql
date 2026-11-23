BEGIN;
SELECT pg_advisory_xact_lock(92370421001);
DO $guard$
BEGIN
 IF (SELECT count(*) FROM saudi_market_metadata) <> 1 OR NOT EXISTS (
   SELECT 1 FROM saudi_market_metadata WHERE market='go-saudi' AND schema_version IN (6,7)
 ) THEN RAISE EXCEPTION 'City franchises require isolated Saudi schema 6 or 7';
 END IF;
END $guard$;
CREATE TABLE IF NOT EXISTS saudi_city_franchises (
 city varchar(80) PRIMARY KEY,
 operator_name varchar(120) NOT NULL CHECK (length(trim(operator_name)) >= 2),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE saudi_city_franchises ADD COLUMN IF NOT EXISTS owner_token_hash varchar(64) UNIQUE;
CREATE TABLE IF NOT EXISTS saudi_franchise_team (
 city varchar(80) NOT NULL REFERENCES saudi_city_franchises(city),
 name varchar(120) NOT NULL,
 mobile varchar(13) NOT NULL,
 role varchar(32) NOT NULL CHECK (role IN ('MARKETING_EXECUTIVE','DELIVERY_PARTNER')),
 hired_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(city,mobile,role)
);
ALTER TABLE saudi_franchise_team ADD COLUMN IF NOT EXISTS member_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE;
ALTER TABLE saudi_franchise_team ADD COLUMN IF NOT EXISTS executive_key_hash varchar(64) UNIQUE;
ALTER TABLE seller_enquiries ADD COLUMN IF NOT EXISTS executive_id uuid;
ALTER TABLE seller_enquiries ADD COLUMN IF NOT EXISTS executive_name varchar(120);
ALTER TABLE saudi_franchise_team ADD COLUMN IF NOT EXISTS delivery_key_hash varchar(64) UNIQUE;
ALTER TABLE saudi_franchise_team ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE saudi_franchise_team ADD COLUMN IF NOT EXISTS longitude double precision;
ALTER TABLE saudi_franchise_team ADD COLUMN IF NOT EXISTS located_at timestamptz;
CREATE TABLE IF NOT EXISTS saudi_delivery_requests (
 order_id varchar(64) PRIMARY KEY REFERENCES saudi_orders(id),
 city varchar(80) NOT NULL,
 pickup_lat double precision NOT NULL CHECK (pickup_lat BETWEEN -90 AND 90),
 pickup_lon double precision NOT NULL CHECK (pickup_lon BETWEEN -180 AND 180),
 created_at timestamptz NOT NULL DEFAULT now(),
 partner_id uuid REFERENCES saudi_franchise_team(member_id),
 completed_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS saudi_delivery_one_active_per_partner
 ON saudi_delivery_requests(partner_id) WHERE partner_id IS NOT NULL AND completed_at IS NULL;
ALTER TABLE saudi_franchise_team ADD COLUMN IF NOT EXISTS push_endpoint text UNIQUE;
ALTER TABLE saudi_franchise_team ADD COLUMN IF NOT EXISTS parked_until timestamptz;
ALTER TABLE saudi_delivery_requests ADD COLUMN IF NOT EXISTS notified_partner uuid;
ALTER TABLE saudi_delivery_requests ADD COLUMN IF NOT EXISTS push_retry_at timestamptz;
CREATE TABLE IF NOT EXISTS saudi_delivery_push_identity(
 singleton boolean PRIMARY KEY CHECK(singleton), public_key text NOT NULL, private_key text NOT NULL
);
ALTER TABLE saudi_delivery_requests ADD COLUMN IF NOT EXISTS offered_to uuid;
ALTER TABLE saudi_delivery_requests ADD COLUMN IF NOT EXISTS offer_until timestamptz;
ALTER TABLE saudi_delivery_requests ADD COLUMN IF NOT EXISTS skipped_partners uuid[] NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS saudi_membership_receipts (
 enquiry_id varchar(64) NOT NULL REFERENCES seller_enquiries(id), term integer NOT NULL CHECK(term>0),
 invoice_id uuid NOT NULL UNIQUE, payment_id uuid NOT NULL UNIQUE, amount_halalas integer NOT NULL CHECK(amount_halalas>0),
 paid_at timestamptz NOT NULL, valid_until timestamptz NOT NULL, executive_id uuid,
 commission_halalas integer NOT NULL CHECK(commission_halalas>=0), PRIMARY KEY(enquiry_id,term)
);
CREATE TABLE IF NOT EXISTS saudi_vendor_invoices (
 enquiry_id varchar(64) NOT NULL REFERENCES seller_enquiries(id), term integer NOT NULL, invoice_id uuid UNIQUE,
 checkout_url text, state text NOT NULL DEFAULT 'creating', checked_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(enquiry_id,term)
);
ALTER TABLE saudi_membership_receipts ADD COLUMN IF NOT EXISTS payout_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE;
ALTER TABLE saudi_membership_receipts ADD COLUMN IF NOT EXISTS payout_state text;
ALTER TABLE saudi_membership_receipts ADD COLUMN IF NOT EXISTS payout_target_hash text;
ALTER TABLE saudi_membership_receipts ADD COLUMN IF NOT EXISTS payout_checked_at timestamptz;
UPDATE saudi_market_metadata SET schema_version=7 WHERE market='go-saudi' AND schema_version=6;
COMMIT;
