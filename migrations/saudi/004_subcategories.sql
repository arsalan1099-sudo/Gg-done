-- Saudi taxonomy v004. Adds optional, exact subcategory classification;
-- legacy private drafts remain editable, but unclassified products cannot enter moderation.
BEGIN;
SELECT pg_advisory_xact_lock(92370421001);
DO $guard$
DECLARE v integer;
BEGIN
 IF to_regclass('public.saudi_market_metadata') IS NULL THEN
   RAISE EXCEPTION 'Saudi DB marker is required';
 END IF;
 SELECT schema_version INTO v FROM saudi_market_metadata WHERE market='go-saudi';
 IF v NOT IN (3,4) OR (SELECT count(*) FROM saudi_market_metadata)<>1 THEN
   RAISE EXCEPTION 'Saudi taxonomy requires isolated schema version 3 or 4';
 END IF;
 IF to_regclass('public.saudi_vendor_draft_products') IS NULL OR
    to_regclass('public.saudi_catalog_submissions') IS NULL THEN
   RAISE EXCEPTION 'Saudi catalog tables are missing';
 END IF;
END $guard$;
ALTER TABLE saudi_vendor_draft_products
 ADD COLUMN IF NOT EXISTS subcategory_id varchar(12);
ALTER TABLE saudi_catalog_submissions
 ADD COLUMN IF NOT EXISTS subcategory_id varchar(12);
DO $checks$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='saudi_draft_subcategory_format') THEN
   ALTER TABLE saudi_vendor_draft_products
    ADD CONSTRAINT saudi_draft_subcategory_format
    CHECK (subcategory_id IS NULL OR subcategory_id ~ '^sc[1-9][0-9]{0,2}
CREATE INDEX IF NOT EXISTS idx_saudi_catalog_subcategory
 ON saudi_catalog_submissions(subcategory_id);
UPDATE saudi_market_metadata SET schema_version=4
 WHERE market='go-saudi' AND schema_version IN (3,4);
COMMIT;
);
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='saudi_catalog_subcategory_format') THEN
   ALTER TABLE saudi_catalog_submissions
    ADD CONSTRAINT saudi_catalog_subcategory_format
    CHECK (subcategory_id IS NULL OR subcategory_id ~ '^sc[1-9][0-9]{0,2}
CREATE INDEX IF NOT EXISTS idx_saudi_catalog_subcategory
 ON saudi_catalog_submissions(subcategory_id);
UPDATE saudi_market_metadata SET schema_version=4
 WHERE market='go-saudi' AND schema_version IN (3,4);
COMMIT;
);
 END IF;
END $checks$;
CREATE INDEX IF NOT EXISTS idx_saudi_catalog_subcategory
 ON saudi_catalog_submissions(subcategory_id);
UPDATE saudi_market_metadata SET schema_version=4
 WHERE market='go-saudi' AND schema_version IN (3,4);
COMMIT;
