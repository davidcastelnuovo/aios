-- STAGING ONLY. Installed after the project identity is checked by the workflow.
-- A DB webhook can bypass an Edge fetch guard, so contain pg_net at its queue.
-- No URL, recipient, body, credential or customer data is saved in this log.
CREATE SCHEMA IF NOT EXISTS environment_sync;
REVOKE ALL ON SCHEMA environment_sync FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS environment_sync.blocked_http (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  method text
);
ALTER TABLE environment_sync.blocked_http ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON environment_sync.blocked_http FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION environment_sync.block_database_http()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE origin text;
BEGIN
  SELECT own_origin INTO origin FROM environment_sync.safety
  WHERE singleton AND outbound_blocked AND guard_version=1;
  IF origin IS NOT NULL AND starts_with(NEW.url, origin || '/functions/v1/') THEN
    RETURN NEW;
  END IF;
  INSERT INTO environment_sync.blocked_http(method) VALUES(NEW.method);
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION environment_sync.block_database_http() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE TRIGGER aios_staging_outbound_block BEFORE INSERT ON net.http_request_queue
FOR EACH ROW EXECUTE FUNCTION environment_sync.block_database_http();
