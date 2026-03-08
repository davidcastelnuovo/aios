

# תוכנית: אנשי קשר מרובים ללקוח

## סקירה
הוספת יכולת לנהל אנשי קשר מרובים לכל לקוח (שם, טלפון, אימייל, תפקיד). בקביעת פגישה — הזימון יישלח לכל אנשי הקשר עם אימייל.

## שינויים

### 1. טבלת DB חדשה — `client_contacts`
```sql
CREATE TABLE client_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  tenant_id uuid REFERENCES tenants(id) NOT NULL,
  contact_name text NOT NULL,
  phone text,
  email text,
  role text, -- תפקיד: "מנכ״ל", "מנהל שיווק" וכו׳
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
```
עם RLS לפי tenant_id.

### 2. EditClientDialog — טאב פרטי לקוח
- מתחת לשדות איש קשר/טלפון/אימייל הקיימים (שיישארו כ"איש קשר ראשי"), הוספת סקשן **"אנשי קשר נוספים"**
- כפתור `+ הוסף איש קשר` שמוסיף שורה עם: שם, טלפון, אימייל, תפקיד, כפתור מחיקה
- אנשי הקשר נשמרים ב-`client_contacts` (CRUD ישירות מהדיאלוג)

### 3. AddClientForm
- אותו מנגנון של + איש קשר, אנשי הקשר הנוספים יישמרו אחרי יצירת הלקוח

### 4. useMeetingScheduler — שליחת זימונים מרובים
- עדכון `scheduleMeeting` לקבל `additionalEmails: string[]`
- הוספת כל האימיילים כ-attendees באירוע יומן Google
- שליחת הזמנת מייל לכל אנשי הקשר עם אימייל (דרך `send-meeting-invitation`)

### 5. EditClientDialog — טאב פגישה
- הצגת רשימת אנשי קשר עם checkbox "שלח זימון ל..." כדי לבחור למי לשלוח

### קבצים לעדכון
1. **Migration SQL** — טבלת `client_contacts` + RLS
2. `src/components/forms/EditClientDialog.tsx` — UI לניהול אנשי קשר + בחירת נמענים בפגישה
3. `src/components/forms/AddClientForm.tsx` — UI להוספת אנשי קשר ביצירה
4. `src/hooks/useMeetingScheduler.ts` — תמיכה במספר attendees

