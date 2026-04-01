

# שיפור תהליך חיבור Unified.to — קטגוריה ואז ספק ספציפי

## הבעיה
כרגע הממשק מציג רק קטגוריות כלליות (כמו "פרסום ממומן") ופותח חלון Unified.to שמציג את כל הספקים בקטגוריה. המשתמש צריך לבחור ספק ספציפי (Google Ads, Meta Ads וכו') כבר בממשק שלנו.

## התיקון

### שלב 1: עדכון Edge Function `unified-connections`
הוספת action חדש `list_integrations` שמושך את רשימת הספקים הזמינים מ-Unified.to API לפי קטגוריה:
- קריאה ל-`GET https://api.unified.to/unified/integration?categories=<category>`
- מחזיר רשימת ספקים עם `name`, `type`, `icon_url`, `categories`

### שלב 2: עדכון ממשק `UnifiedSettings.tsx`
שינוי הדיאלוג לתהליך דו-שלבי:

1. **שלב ראשון** — בחירת קטגוריה (נשאר כמו היום — רשימת כרטיסים)
2. **שלב שני** — לאחר בחירת קטגוריה, מושכים מ-API את רשימת הספקים הספציפיים ומציגים אותם כרשימה עם אייקונים (Google Ads, Meta Ads, TikTok Ads וכו')
3. **שלב שלישי** — לחיצה על ספק פותחת את חלון Unified.to עם `integration_type` ספציפי במקום קטגוריה כללית

### שלב 3: שמירת Workspace ID כ-Secret
במקום לבקש מהמשתמש להזין Workspace ID בכל פעם, נשמור אותו ב-`tenant_integrations` (או ב-tenant settings) פעם אחת ונשתמש בו אוטומטית.

### פרטים טכניים

**Edge Function — action חדש:**
```
GET https://api.unified.to/unified/integration?categories=ads
→ מחזיר: [{ name: "Google Ads", type: "google_ads", icon_url: "...", ... }]
```

**Embed URL משופר:**
במקום לשלוח רק `categories=ads`, נשלח גם `integration_type=google_ads` כדי להציג רק את הספק שנבחר.

**קבצים שישתנו:**
- `supabase/functions/unified-connections/index.ts` — הוספת action `list_integrations`
- `src/pages/UnifiedSettings.tsx` — שינוי הדיאלוג ל-wizard דו-שלבי, הסרת שדה Workspace ID (יילקח אוטומטית)

