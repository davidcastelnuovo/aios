

# תוכנית: סינון אימיילים לפי תגיות Gmail (Labels)

## מה ייבנה
הוספת אפשרות בהגדרות Gmail להגדיר אילו תגיות (Labels) של Gmail מורשות להיכנס למערכת. אימיילים שלא שייכים לתגיות המורשות לא יוצגו.

## שינויים

### 1. טבלה חדשה — `gmail_allowed_labels`
```sql
CREATE TABLE gmail_allowed_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label_id text NOT NULL,        -- e.g. "INBOX", "CATEGORY_PROMOTIONS", "Label_123"
  label_name text NOT NULL,      -- Display name
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, label_id)
);
ALTER TABLE gmail_allowed_labels ENABLE ROW LEVEL SECURITY;
-- RLS policies for authenticated users on their own data
```

### 2. Edge Function `gmail-api` — פעולה חדשה `listLabels`
הוספת action `listLabels` שקורא ל-Gmail API endpoint:
```
GET https://gmail.googleapis.com/gmail/v1/users/me/labels
```
ומחזיר רשימת כל התגיות (שם + ID) של חשבון Gmail.

### 3. הגדרות Gmail (`GmailSettings.tsx`) — סקשן חדש
כרטיס חדש "תגיות מורשות" עם:
- כפתור "טען תגיות מ-Gmail" שקורא ל-`listLabels`
- Dropdown/checklist של כל התגיות הזמינות
- אפשרות לסמן אילו תגיות מורשות
- שמירה ל-`gmail_allowed_labels`

### 4. תצוגת Gmail (`Gmail.tsx`) — סינון לפי תגיות
- שליפת `gmail_allowed_labels` של המשתמש
- אם יש תגיות מוגדרות, הוספת `label:` ל-query או שימוש ב-`labelIds` parameter
- **אימיילים ללא תגיות מורשות לא יוצגו כלל**

### קבצים לשינוי
1. **מיגרציה** — יצירת טבלת `gmail_allowed_labels` + RLS
2. **`supabase/functions/gmail-api/index.ts`** — הוספת action `listLabels`
3. **`src/pages/GmailSettings.tsx`** — סקשן בחירת תגיות מורשות
4. **`src/pages/Gmail.tsx`** — סינון הודעות לפי תגיות מורשות

