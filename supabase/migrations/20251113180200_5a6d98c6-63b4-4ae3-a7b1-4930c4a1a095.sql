-- Add badge column to menu_items table
ALTER TABLE menu_items 
ADD COLUMN badge text CHECK (badge IN ('coming_soon', 'premium', NULL));