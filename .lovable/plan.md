# תיקון Carmen: זיכרון, סקיל איקומרס, בדיקת חשבונות מודעות

## שפה משותפת לבניית סוכנים (terminology)

נשתמש בז'רגון אחיד מעכשיו - גם בקוד וגם בשיחות איתי:

- **Agent** = הסוכן עצמו (Carmen). מוח אחד עם זיכרון אחד.
- **Surface** = איפה מדברים איתה: `whatsapp` | `internal_chat` | `aios` | `task` (background).
- **Skill** = יכולת ממוקדת = פרומפט קשיח + רשימת tools מותרת + פלט מובנה. דוגמאות: `pulse_check`, `ecommerce_pulse`, `ad_accounts_health`.
- **Tool** = פונקציה אטומית שכרמן יכולה לקרוא לה (analyze_campaign_performance, list_facebook_ad_accounts וכד').
- **Memory** = `ai_memory` (key/value, instructions) + `agent_memory` (FTS חוצה-שיחות) + `carmen_memory_episodes` (אירועי שיחה).
- **Episode / Action log** = `agent_action_log` - לוג של כל turn (surface, tools_used, output).

מעכשיו כשאני אגיד "תוסיפי סקיל X" - הכוונה: פרומפט hardcoded חדש ב-`_shared/skills/` + רישום ברגיסטרי + טריגר מילות-מפתח.

---

## 1. תיקון הזיכרון (לא נשמר גם אחרי ההוק)

הבעיה: ה-pre-save hook ב-`run-ai-agent` פועל רק על trigger words אנגלית/עברית מצומצמים, ולא תופס "תזכרי גם בזיכרון" בהקשר של הוראת ביצוע (כמו בצילום: "תזכרי שגם בזיכרון קמפיינר איקומרס...").

תיקון:
- הרחבת רגקס הטריגר ב-`run-ai-agent/index.ts`: מוסיפים `שימי לב`, `תכניסי לזיכרון`, `גם בזיכרון`, `הוסיפי לזיכרון`, `אל תשכחי`, `learn this`, `note that`.
- כשמזהים טריגר - שולפים את **כל המשפט/פסקה** סביב הטריגר (לא רק keyword), לא 80 תווים שטוחים.
- כותבים בו-זמנית ל-3 מקומות (ללא תלות בהצלחת המודל לקרוא ל-`save_memory`):
  1. `ai_memory` - category=`instructions`, key=hash סמנטי (snake_case מתוך תקציר LLM קצר), value=טקסט מלא.
  2. `agent_memory` - importance=8, content=טקסט מלא, tags=['user_instruction', surface].
  3. `carmen_memory_episodes` - kind=`instruction_captured`.
- מוסיפים בפרומפט אזהרה מפורשת: "אם נכשלת ב-save_memory - חזרי וקראי שוב לפני שאת עונה".
- בלוג של `agent_action_log` נוסיף שדה `instructions_captured: string[]` כדי לראות בעין שזה עבד.

בדיקה: שולחים בצ'אט הפנימי "תזכרי שלקוחות איקומרס מקבלים רווח+CPP+כמות רכישות"  →  שורה ב-`ai_memory` נוצרת מיד  →  בשיחה הבאה `recall_memory` מחזיר אותה.

---

## 2. סקיל חדש: `ecommerce_pulse` (רווח, CPP, כמות רכישות)

קובץ חדש: `supabase/functions/_shared/skills/ecommerce-pulse.ts`

תוכן הסקיל (פרומפט hardcoded):
- טריגר: לקוח מסומן `client_type='ecommerce'` או tag/שדה custom שמסמן איקומרס. אם לא קיים - נוסיף עמודה `is_ecommerce boolean` ל-`clients` (migration).
- מקור נתונים: **Meta Ads + Shopify/WooCommerce** (לפי הבחירה שלך).
  - Meta Ads (קיים): `purchases`, `purchase_value`, `spend` מתוך `facebook_insights` שכרמן כבר ניגשת אליו ב-`analyze_campaign_performance`.
  - WooCommerce: דרך הקונקטור הקיים (טבלאות `woocommerce_orders`) - מצרפים order count + revenue לפי תאריך.
  - Shopify: דרך אינטגרציית Shopify הקיימת (אם הלקוח חיבר). אם לא חיבר - מדווחים `shop_not_connected`.
- מטריקות שנחזיר ללקוח איקומרס במקום CPL:
  - `purchases_7d`, `purchases_30d` (מס' רכישות)
  - `cpp_7d` = `spend_7d / purchases_7d` (Cost Per Purchase)
  - `revenue_7d`, `profit_7d` = `revenue - spend` (אם יש cogs בשדה custom נחסיר אותו)
  - `roas_7d` = `revenue / spend`
- פלט: באותה תבנית של pulse_check אבל "X רכישות | CPP Y | רווח Z | ROAS W" במקום "X לידים | CPL Y".
- Tools מותרים בסקיל: `analyze_campaign_performance`, `list_woocommerce_orders` (חדש), `list_shopify_orders` (חדש אם נחבר), `get_client_meta_purchases` (wrapper).

---

## 3. הרחבת `pulse_check`: בדיקת תקינות חשבונות מודעות

מוסיפים שלב חדש לסקיל הקיים: **Ad Accounts Health**.

לכל לקוח עם חשבון מודעות מחובר (FB/Google), לרוץ במקביל לבדיקה הרגילה ולהדגיש דגלים אדומים אם:
- ❌ `account_status` ∈ {disabled, closed, pending_review} (Meta: status≠1; Google: SUSPENDED/CANCELLED)
- ⚠️ `spend_7d == 0` (אין הוצאה 7 ימים אחרונים) - דגל כתום
- ⚠️ כל הקמפיינים `paused/off` (לא רץ כלום)
- ❌ `token_expired` או שגיאת API מהקונקטור (`fireIntegrationAlert` כבר קיים ל-`ad_account_blocked` - נשתמש בו)

Tool חדש: `check_ad_accounts_health(client_id?, agency_id?)` - מחזיר לכל לקוח:
```
{ client_id, fb: { status, has_spend_7d, all_paused, token_ok }, google: { ... }, flags: ['fb_disabled', 'google_no_spend_7d'] }
```

בפלט הסיכום (בצילום שלך) יתווסף בלוק:
```
🚨 חשבונות מודעות לא תקינים:
• אביאלי טייג — FB account disabled
• כביר מונטנג — Google: אין spend 7 ימים
• קרניליוס — Token פג, צריך חיבור מחדש
```

מימוש Tool:
- FB: GET `/me/adaccounts?fields=account_status,name,currency,spend_cap` דרך הטוקן הקיים.
- Google Ads: דרך הקונקטור הקיים, customer.status.
- Spend 7d: קוורי מצומצם על `facebook_insights` / `google_ads_insights` עם `date_start >= now()-7d`.
- אם API מחזיר 401/403 - יורים `fireIntegrationAlert('ad_account_blocked', client_id)`.

---

## 4. רגיסטרי סקילז (תשתית, פעם אחת)

קובץ חדש: `supabase/functions/_shared/skills/registry.ts`
```ts
export const SKILLS = {
  pulse_check: { triggers: ['בדיקת דופק','pulse'], prompt: pulseCheckPrompt, tools: [...] },
  ecommerce_pulse: { triggers: ['בדיקת דופק איקומרס','ecommerce'], prompt: ecomPrompt, tools: [...] },
  ad_accounts_health: { triggers: ['חשבונות מודעות','ad accounts'], prompt: adHealthPrompt, tools: [...] },
}
```

ב-`run-ai-agent` לפני שליחת הפרומפט: מזהים סקיל אקטיבי לפי טריגר במסר → מזריקים את `prompt` שלו לסיסטם + מסננים את `tools` המוצעים לאותם שמותרים. זה מונע hallucination ומבטיח עקביות.

`pulse_check` הקיים יעוטף גם הוא בסקיל ב-registry (העברת הטקסט שכבר נמצא ב-`carmen-prompt-v2.ts` שורות 150–155 לקובץ דדיקייטד).

---

## 5. קבצים שישתנו / יווצרו

נוצרים:
- `supabase/functions/_shared/skills/registry.ts`
- `supabase/functions/_shared/skills/pulse-check.ts`
- `supabase/functions/_shared/skills/ecommerce-pulse.ts`
- `supabase/functions/_shared/skills/ad-accounts-health.ts`
- migration: עמודה `is_ecommerce boolean default false` ב-`clients`

נערכים:
- `supabase/functions/run-ai-agent/index.ts` - הרחבת trigger regex לזיכרון, רישום skill resolver, tools חדשים (`check_ad_accounts_health`, `list_woocommerce_orders`).
- `supabase/functions/_shared/carmen-prompt-v2.ts` - הפניה ל-skill registry במקום הטקסט המוטבע של pulse_check.
- `supabase/functions/_shared/carmen.ts` - הרחבת `forceToolsForPulse` כדי לכלול גם ecommerce + ad health.

---

## אישור

אחרי שתאשר אעבור ל-Build mode וארוץ הכל ברצף: migration → skills files → עריכת run-ai-agent → deploy של הפונקציה → בדיקה ידנית בצ'אט.
