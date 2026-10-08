-- Add category column to crm_tables for grouping functionality
ALTER TABLE crm_tables 
ADD COLUMN IF NOT EXISTS category TEXT;