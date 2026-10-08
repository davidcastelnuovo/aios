
-- מחיקת אילנית הכפולה שאין לה לקוחות משויכים
DELETE FROM campaigner_agencies WHERE campaigner_id = '58a05c32-69d4-4ca4-9c87-4ca5ac6662cf';
DELETE FROM campaigners WHERE id = '58a05c32-69d4-4ca4-9c87-4ca5ac6662cf';
