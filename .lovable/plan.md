

# תכנית: אינטגרציית Gmail מלאה (שליחה + קבלה + ארגון + חסימה)

## סקירה
בניית מודול Gmail מלא שמאפשר למשתמשים לחבר את חשבון הגוגל שלהם, לצפות במיילים, לשלוח מיילים, לארגן לפי קטגוריות, ולחסום כתובות ספציפיות.

## ארכיטקטורה

### שלב 1: טבלאות בסיס נתונים

**`gmail_tokens`** - אחסון OAuth tokens (בדומה ל-`calendar_tokens`):
- `user_id`, `tenant_id`, `access_token`, `refresh_token`, `expires_at`, `google_email`

**`gmail_categories`** - קטגוריות מותאמות אישית לכל tenant:
- `id`, `tenant_id`, `name`, `color`, `sort_order`

**`gmail_message_categories`** - שיוך מיילים לקטגוריות:
- `id`, `tenant_id`, `user_id`, `message_id` (Gmail message ID), `category_id`

**`gmail_blocked_senders`** - כתובות חסומות:
- `id`, `tenant_id`, `user_id`, `email_address`, `blocked_at`

### שלב 2: Edge Functions

**`gmail-auth/index.ts`** - OAuth flow (init, callback, disconnect, status):
- משתמש ב-`GOOGLE_CLIENT_ID` ו-`GOOGLE_CLIENT_SECRET` הקיימים
- Scopes: `gmail.readonly`, `gmail.send`, `gmail.modify`
- אותו דפוס כמו `google-calendar-auth`

**`gmail-api/index.ts`** - API proxy לפעולות Gmail:
- `list` - רשימת מיילים (עם חיפוש, פילטור)
- `get` - קריאת מייל בודד
- `send` - שליחת מייל
- `reply` - מענה למייל
- Token refresh אוטומטי

### שלב 3: דף הגדרות Gmail

**`src/pages/GmailSettings.tsx`**:
- חיבור/ניתוק חשבון Google
- ניהול קטגוריות (הוספה, עריכה, מחיקה)
- ניהול רשימת חסומים

### שלב 4: דף תיבת דואר (Email Inbox)

**`src/pages/Gmail.tsx`** - ממשק תיבת דואר:
- רשימת מיילים עם חיפוש
- סינון לפי קטגוריה
- סימון מיילים בקטגוריות (drag או dropdown)
- חסימת שולח בלחיצה
- צפייה במייל בודד
- כתיבת/מענה למייל
- מיילים מכתובות חסומות מוסתרים אוטומטית

### שלב 5: עדכון ניווט ואינטגרציות

- הוספת כרטיס Gmail לדף `Integrations.tsx`
- הוספת route חדש ב-`App.tsx`
- הוספת פריט תפריט ב-menu items

## קבצים חדשים
1. `supabase/functions/gmail-auth/index.ts`
2. `supabase/functions/gmail-api/index.ts`
3. `src/pages/GmailSettings.tsx`
4. `src/pages/Gmail.tsx`

## קבצים לעריכה
1. `src/pages/Integrations.tsx` - הוספת כרטיס Gmail
2. `src/App.tsx` - הוספת routes
3. `supabase/config.toml` - הגדרת JWT verification
4. מיגרציות DB - יצירת טבלאות + RLS

## הערה חשובה
זה פרויקט גדול. אמליץ לפרק ליישום בשלבים:
1. קודם OAuth + הגדרות (חיבור חשבון)
2. אח"כ תיבת דואר + קריאת מיילים
3. אח"כ שליחה + מענה
4. לבסוף קטגוריות + חסימה

