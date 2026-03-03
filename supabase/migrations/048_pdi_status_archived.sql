-- Add 'archived' to PDI status. Flow: closed -> archived (HR only).
ALTER TABLE pdis
  DROP CONSTRAINT IF EXISTS pdis_status_check;

ALTER TABLE pdis
  ADD CONSTRAINT pdis_status_check
  CHECK (status IN ('draft', 'in_approval', 'active', 'closed', 'archived'));

COMMENT ON TABLE pdis IS 'Individual development plans; status: draft -> in_approval -> active -> closed -> archived';
