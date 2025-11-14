-- Add parent_menu_key column to menu_items if not exists
ALTER TABLE menu_items 
ADD COLUMN IF NOT EXISTS parent_menu_key text;

-- Update management items to be children of management
UPDATE menu_items 
SET parent_menu_key = 'management'
WHERE sort_order BETWEEN 101 AND 199
AND menu_key != 'management';

-- Update sales items to be children of sales
UPDATE menu_items 
SET parent_menu_key = 'sales'
WHERE sort_order BETWEEN 201 AND 299
AND menu_key != 'sales';

-- Move management and sales to main menu
UPDATE menu_items 
SET sort_order = 50
WHERE menu_key = 'management';

UPDATE menu_items 
SET sort_order = 60
WHERE menu_key = 'sales';

-- Add comment for documentation
COMMENT ON COLUMN menu_items.parent_menu_key IS 'References menu_key of parent item for hierarchical menus';