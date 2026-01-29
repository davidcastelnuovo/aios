
# תוכנית: סנכרון מחדש של לידים ל-ManyChat בארגון Nexus Capital

## סיכום המצב הנוכחי

| סטטיסטיקה | כמות |
|-----------|------|
| סה"כ לידים | 482 |
| ללא ManyChat ID | 290 |
| עם SYNC_CONFLICT | 11 |
| עם NEEDS_MANUAL_LINK | 2 |
| עם ID תקין | 179 |

## מה המשתמש מבקש

1. **לאפס** את כל ה-manychat_subscriber_id הקיימים לכל הלידים בארגון Nexus Capital
2. **לרשום מחדש** את כל הלידים ב-ManyChat אחד אחד
3. **להוסיף שדה נראה** של ManyChat ID בטופס הליד
4. לידים חדשים - לוודא שהם נרשמים ב-ManyChat עם Custom Field ומקבלים ID

---

## שלב 1: איפוס כל ה-ManyChat IDs (פעולה חד-פעמית)

נריץ פקודת UPDATE על טבלת leads לאפס את כל ה-manychat_subscriber_id ל-NULL עבור הארגון:

```sql
UPDATE leads 
SET manychat_subscriber_id = NULL 
WHERE tenant_id = 'eb31659b-7a21-4411-b99d-01df51cf2895';
```

**זה יאפס את כל 482 הלידים** (גם אלה עם SYNC_CONFLICT ואלה עם ID תקין) כדי שכולם יוכלו להירשם מחדש.

---

## שלב 2: הוספת שדה ManyChat ID לטופס הליד

### 2.1 הוספה לטבלת custom_fields

נוסיף שדה חדש `manychat_subscriber_id` עם `is_visible: true` כדי שיוצג בטפסים ובכרטיסים:

```sql
INSERT INTO custom_fields (
  tenant_id, 
  entity_type, 
  field_key, 
  field_label, 
  field_type, 
  is_visible, 
  is_required, 
  sort_order
)
VALUES (
  'eb31659b-7a21-4411-b99d-01df51cf2895',
  'lead',
  'manychat_subscriber_id',
  'ManyChat ID',
  'text',
  true,
  false,
  14
) ON CONFLICT (tenant_id, entity_type, field_key) DO UPDATE 
  SET is_visible = true, field_label = 'ManyChat ID';
```

### 2.2 עדכון קוד התצוגה

נוסיף את השדה לקומפוננטות:

| קובץ | שינוי |
|------|-------|
| `EditLeadDialog.tsx` | הצגת שדה ManyChat ID (לקריאה בלבד) בטאב הפרטים |
| `Leads.tsx` | הוספת עמודה בטבלה שמציגה את ה-ManyChat ID (או "ממתין לסנכרון") |

---

## שלב 3: יצירת Edge Function לסנכרון מחדש

### פונקציה חדשה: `resync-all-leads-to-manychat`

במקום להשתמש בפונקציית `bulk-sync-leads-to-manychat` הקיימת, ניצור פונקציה חדשה שתעשה:

1. **איפוס אוטומטי** של manychat_subscriber_id ל-NULL לפני תחילת הסנכרון
2. **יצירת subscriber חדש** ב-ManyChat (עם phone, whatsapp_phone וגם Custom Field `phone_number`)
3. **שמירת ה-ID** שחזר מ-ManyChat בטבלת leads
4. **הוספת tag** לכל subscriber שנוצר

### לוגיקה משופרת

```text
1. קבל את כל הלידים עם phone != NULL
2. לכל ליד:
   a. נסה למצוא subscriber קיים (לפי phone, email, custom field)
   b. אם לא נמצא - צור subscriber חדש עם:
      - first_name, last_name
      - phone: +972XXXXXXXXX
      - whatsapp_phone: +972XXXXXXXXX
      - email (אם קיים)
   c. אחרי יצירה - שמור את phone ב-Custom Field "phone_number"
   d. הוסף tag
   e. עדכן את הליד עם ה-subscriber_id
   f. המתן 10 שניות (Rate Limit)
```

---

## שלב 4: ממשק הסנכרון

### עדכון ManyChatSettings.tsx

נוסיף כפתור "סנכרון מלא מחדש" שיעשה:
1. אזהרה למשתמש: "פעולה זו תאפס את כל ה-ManyChat IDs ותרשום מחדש את כל הלידים"
2. אישור
3. קריאה לפונקציה `resync-all-leads-to-manychat`

---

## סיכום הקבצים לעדכון

| קובץ | פעולה |
|------|-------|
| **SQL (Insert Tool)** | איפוס manychat_subscriber_id + הוספת custom field |
| `supabase/functions/resync-all-leads-to-manychat/index.ts` | **יצירה חדשה** - פונקציית סנכרון מלא |
| `src/pages/ManyChatSettings.tsx` | הוספת כפתור "סנכרון מלא מחדש" + פרוגרס |
| `src/components/forms/EditLeadDialog.tsx` | הצגת שדה ManyChat ID |
| `src/pages/Leads.tsx` | הוספת עמודה ManyChat ID בטבלה |

---

## תוצאה צפויה

1. **כל 482 הלידים** יאופסו ויירשמו מחדש ב-ManyChat
2. **שדה ManyChat ID** יהיה נראה בטופס הליד ובטבלה
3. **לידים חדשים** יירשמו אוטומטית ב-ManyChat עם Custom Field ויקבלו ID
4. **לא יהיו יותר SYNC_CONFLICT** כי נשתמש ב-field_id הנכון
