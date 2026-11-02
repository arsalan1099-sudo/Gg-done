-- Saudi isolated product catalog v003. Never run against Go Bharat database.
BEGIN;
SELECT pg_advisory_xact_lock(92370421001);
DO $guard$
DECLARE ver integer;
BEGIN
 IF to_regclass('public.saudi_market_metadata') IS NULL THEN
   RAISE EXCEPTION 'Saudi market metadata is required';
 END IF;
 SELECT schema_version INTO ver FROM saudi_market_metadata WHERE market='go-saudi';
 IF ver NOT IN (2,3) OR (SELECT count(*) FROM saudi_market_metadata)<>1 THEN
   RAISE EXCEPTION 'Saudi catalog migration requires isolated schema version 2 or 3';
 END IF;
 IF to_regclass('public.saudi_vendor_draft_products') IS NULL THEN
   RAISE EXCEPTION 'Saudi draft inventory missing';
 END IF;
END $guard$;
CREATE TABLE IF NOT EXISTS saudi_catalog_submissions (
 id varchar(64) PRIMARY KEY,
 vendor_id varchar(64) NOT NULL REFERENCES saudi_vendor_accounts(id) ON DELETE CASCADE,
 draft_id varchar(64) NOT NULL UNIQUE REFERENCES saudi_vendor_draft_products(id) ON DELETE CASCADE,
 title varchar(120) NOT NULL,
 description text NOT NULL DEFAULT '',
 price_halalas integer NOT NULL CHECK (price_halalas BETWEEN 1 AND 100000000),
 stock integer NOT NULL CHECK (stock BETWEEN 0 AND 1000000),
 status varchar(16) NOT NULL DEFAULT 'PENDING'
   CHECK (status IN ('PENDING','APPROVED','REJECTED')),
 requested_at timestamp NOT NULL DEFAULT now(),
 review_note varchar(500) NOT NULL DEFAULT '',
 reviewed_at timestamp
);
CREATE INDEX IF NOT EXISTS idx_saudi_catalog_status ON saudi_catalog_submissions(status,requested_at);
CREATE INDEX IF NOT EXISTS idx_saudi_catalog_vendor ON saudi_catalog_submissions(vendor_id);
UPDATE saudi_market_metadata SET schema_version=3 WHERE market='go-saudi' AND schema_version IN (2,3);
COMMIT;
