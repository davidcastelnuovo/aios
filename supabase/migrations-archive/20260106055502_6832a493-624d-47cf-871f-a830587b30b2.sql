-- Add is_default column to agencies table
ALTER TABLE agencies ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Create function to ensure only one default agency per tenant
CREATE OR REPLACE FUNCTION ensure_single_default_agency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE agencies SET is_default = false 
    WHERE tenant_id = NEW.tenant_id AND id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS trg_single_default_agency ON agencies;

-- Create trigger for single default agency per tenant
CREATE TRIGGER trg_single_default_agency
BEFORE INSERT OR UPDATE ON agencies
FOR EACH ROW EXECUTE FUNCTION ensure_single_default_agency();