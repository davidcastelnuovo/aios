## TikTok Integration — תוכנית עבודה

### הבהרה חשובה לפני שמתחילים
ה-TikTok Connector של Lovable (Gateway) נותן גישה לתוכן **אורגני** של חשבון TikTok:
- פרופיל (followers, display_name)
- רשימת סרטונים + סטטיסטיקות (views, likes, comments, shares, watch time)

**TikTok Ads (קמפיינים בתשלום)** משתמש ב-**Marketing API נפרד** שלא נכלל בקונקטור. אם רוצים בעתיד נתוני Ads — צריך אינטגרציה נפרדת (App Review של TikTok for Business + Marketing API). התוכנית הזו מתמקדת בדוחות אורגניים.

לכן הטבלה החדשה תיקרא **"TikTok Content"** (לא "TikTok Ads") — ניתוח ביצועי סרטונים.

---

### 1. חיבור הקונקטור (פעם אחת)
- חיבור TikTok Connector של Lovable (`connector_id: tiktok`) ל-Project. זה ייתן את `TIKTOK_API_KEY` כ-secret אוטומטי לכל edge functions.
- אנחנו לא צריכים App Review של TikTok בעצמנו — הקונקטור עוקף את זה.

### 2. דף Integrations — כרטיס TikTok
הוספת כרטיס TikTok ב-`src/pages/Integrations.tsx` שמוביל למסך `tiktok-settings` חדש.

`is_connected` ייקבע לפי רשומה ב-`tenant_integrations` עם `integration_type='tiktok'`.

### 3. מסך TikTokSettings חדש
דף הגדרות (`src/pages/TikTokSettings.tsx`) שמאפשר:
- כפתור "Connect TikTok Account" → קורא ל-edge function `tiktok-connect` שמושך פרטי חשבון מהקונקטור (`/user/info/?fields=open_id,display_name,avatar_url,follower_count`) ושומר ב-`tenant_integrations`.
- תצוגה של החשבון המחובר (שם, אווטאר, עוקבים).
- כפתור Disconnect.
- (אם בעתיד יהיו multiple accounts — נוסיף בחירה. כרגע חשבון אחד לכל tenant, כמו Facebook.)

### 4. Edge Functions חדשות
| פונקציה | תפקיד |
|---|---|
| `tiktok-connect` | מושך פרטי חשבון מ-TikTok Gateway ושומר ב-`tenant_integrations` (integration_type='tiktok') |
| `tiktok-disconnect` | מוחק את החיבור |
| `sync-tiktok-content` | On-demand: מושך רשימת סרטונים + stats → כותב ל-`crm_records` עבור `table_id` נתון (integration_type='tiktok_content') |
| `cron-sync-tiktok-content` | סקדיולר יומי: רץ על כל `crm_tables` עם integration_type='tiktok_content' |

כולן יקראו דרך Gateway:
```
GET  https://connector-gateway.lovable.dev/tiktok/user/info/?fields=...
POST https://connector-gateway.lovable.dev/tiktok/video/list/
```
עם headers `Authorization: Bearer ${LOVABLE_API_KEY}` + `X-Connection-Api-Key: ${TIKTOK_API_KEY}`.

### 5. דף Dynamic Tables — אפשרות יצירת טבלת TikTok
ב-`src/pages/DynamicTables.tsx`:
- הוספת אפשרות חדשה לדיאלוג יצירת טבלה: **"TikTok Content"** (ליד "Facebook Ecommerce").
- דיאלוג חדש `TikTokTableDialog.tsx` (במודל של `FacebookTableDialog`) — שואל שם טבלה, בוחר חשבון מחובר, יוצר רשומה ב-`crm_tables` עם:
  ```
  integration_type: 'tiktok_content'
  integration_settings: { account_open_id, date_range, sync_frequency }
  ```
- אחרי יצירה — מפעיל `sync-tiktok-content` פעם ראשונה.
- ב-`getIntegrationIcon` מוסיפים case ל-`tiktok_content` עם אייקון TikTok.
- בכרטיס הטבלה — כפתור Sync שמפעיל מחדש את `sync-tiktok-content`.

### 6. שדות (crm_fields) של טבלת TikTok Content
ייווצרו אוטומטית בסנכרון ראשון:
- `video_id`, `title`, `create_time`, `cover_image_url`, `share_url`
- `view_count`, `like_count`, `comment_count`, `share_count`
- `duration_sec`, `embed_link`

---

### פרטים טכניים

**שמירה ב-tenant_integrations** (אותו pattern כמו Facebook):
```json
{
  "tenant_id": "...",
  "integration_type": "tiktok",
  "is_active": true,
  "settings": {
    "open_id": "...",
    "display_name": "...",
    "avatar_url": "...",
    "follower_count": 1234,
    "connected_at": "2026-05-31T..."
  }
}
```

**אבטחה (RLS):**
- אותן מדיניות RLS שכבר קיימות על `tenant_integrations` ו-`crm_tables` (סינון לפי `tenant_id` + cross-tenant agency access).
- אין שינויי סכימה נדרשים — הכל משתמש במבנה הגנרי הקיים.

**Routing:**
- הוספת route `/t/:tenantSlug/integrations/tiktok-settings` ב-`App.tsx`.

---

### מה לא נכלל בתוכנית הזו (יבוא בעתיד אם תרצה)
- TikTok Ads (קמפיינים בתשלום) — דורש Marketing API נפרד.
- פרסום סרטונים מתוך המערכת (`post/publish/video/init/`).
- ניהול תגובות על סרטונים.

### שלבי ביצוע
1. חיבור הקונקטור (פעולה אינטראקטיבית — תאשר חיבור TikTok)
2. יצירת 4 edge functions
3. הוספת דף Integrations card + TikTokSettings page + route
4. הוספת TikTokTableDialog + שינויים ב-DynamicTables.tsx + integrationIcons
5. בדיקה: חיבור → יצירת טבלה → סנכרון ראשון → תצוגת נתונים

לאחר אישור התוכנית — אעבור ל-Build, אבקש לחבר את הקונקטור, ואז אכתוב את הקוד.