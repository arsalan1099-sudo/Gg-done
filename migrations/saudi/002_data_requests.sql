-- Saudi-only incremental migration, version 002. Records account-deletion
-- requests without retaining merchant identifiers after deletion.
BEGIN;
SELECT pg_advisory_xact_lock(92370421001);
DO $guard$
DECLARE v integer;
BEGIN
 IF to_regclass('public.saudi_market_metadata') IS NULL THEN
   RAISE EXCEPTION 'Saudi marker required before migration 002';
 END IF;
 SELECT schema_version INTO v FROM saudi_market_metadata WHERE market='go-saudi';
 IF v IS NULL OR v NOT IN (1,2) OR (SELECT count(*) FROM saudi_market_metadata)<>1 THEN
   RAISE EXCEPTION 'Incorrect market / schema version for Saudi migration 002';
 END IF;
 IF to_regclass('public.saudi_vendor_accounts') IS NULL THEN
   RAISE EXCEPTION 'Saudi accounts missing';
 END IF;
END $guard$;
CREATE TABLE IF NOT EXISTS saudi_vendor_data_requests (
 id varchar(64) PRIMARY KEY,
 vendor_id varchar(64) REFERENCES saudi_vendor_accounts(id) ON DELETE SET NULL,
 request_type varchar(24) NOT NULL DEFAULT 'DELETE_ACCOUNT',
 status varchar(24) NOT NULL DEFAULT 'PENDING',
 requested_at timestamp NOT NULL DEFAULT now(),
 processed_at timestamp,
 CONSTRAINT saudi_data_request_type CHECK (request_type='DELETE_ACCOUNT'),
 CONSTRAINT saudi_data_request_status CHECK (status IN ('PENDING','COMPLETED'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_saudi_data_request_one_pending
  ON saudi_vendor_data_requests(vendor_id) WHERE status='PENDING';
CREATE INDEX IF NOT EXISTS idx_saudi_data_request_status
  ON saudi_vendor_data_requests(status,requested_at);
CREATE INDEX IF NOT EXISTS idx_saudi_data_request_vendor
  ON saudi_vendor_data_requests(vendor_id);
UPDATE saudi_market_metadata SET schema_version=2 WHERE market='go-saudi' AND schema_version IN (1,2);
COMMIT;
