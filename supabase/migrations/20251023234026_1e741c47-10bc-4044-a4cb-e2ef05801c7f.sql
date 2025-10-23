-- Add missing fields for CSV import
ALTER TABLE leads ADD COLUMN IF NOT EXISTS products text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sale_date date;

COMMENT ON COLUMN leads.products IS 'Products/services discussed';
COMMENT ON COLUMN leads.sale_date IS 'Sale/contract date';