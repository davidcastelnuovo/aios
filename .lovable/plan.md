# Carmen Ad-Ops Toolkit (Meta + Google Ads)

הרחבת כרמן עם יכולות מלאות לניהול קמפיינים מהוואטסאפ — כולל שמירת מדיה מההתכתבות, יצירה/עריכה של קמפיינים, מודעות, לידפורמים, אופטימיזציה ותזמון. **כל פעולה מבצעת — דורשת אישור בוואטסאפ לפני ביצוע** דרך `agent_approval_queue` (קיים).

## 1. תשתית מדיה (Media Library)

**Storage bucket חדש** `carmen-media` (פרטי, RLS על tenant_id).

**טבלה חדשה** `marketing_media_library`:
- `id`, `tenant_id`, `client_id?`, `lead_id?`
- `bucket_path`, `mime_type`, `file_size`, `width/height`
- `source` (`whatsapp` | `telegram` | `upload` | `ai_generated`)
- `source_message_id?` (קישור ל-`chat_messages.id`)
- `caption`, `tags[]`, `usage_count`
- `created_by`, `created_at`
- GRANT + RLS לפי tenant + has_role

**Edge Function חדש** `carmen-save-media`:
- מקבל message_id או media_url מההתכתבות
- מוריד את הקובץ (Green API / Manus / Telegram URL)
- מעלה ל-bucket `carmen-media/{tenant_id}/{client_id}/...`
- יוצר רשומה ב-`marketing_media_library` עם שיוך ללקוח/ליד אוטומטית מההתכתבות

## 2. כלי כרמן חדשים (Skill Registry)

נוספים ל-`supabase/functions/_shared/skills/registry.ts` ול-`mcp-tools.ts`:

### מדיה
- `save_media_from_chat({ message_id?, client_id?, lead_id?, tags?, caption? })` — שומר מדיה מהודעה ספציפית או מההודעה האחרונה בשיחה
- `list_client_media({ client_id, limit?, tags? })` — רשימת מדיה של לקוח
- `link_media_to_client({ media_id, client_id })`

### Meta (Facebook + Instagram)
- `create_fb_campaign({ client_id, name, objective, daily_budget, ... })` → `needsApproval: true`
- `create_fb_adset({ campaign_id, targeting, schedule, optimization_goal, ... })` → approval
- `create_fb_ad({ adset_id, creative: { media_id, headline, primary_text, cta, link }, ... })` → approval
- `replace_lead_form({ ad_id, new_form_id })` → approval
- `update_fb_creative({ ad_id, media_id?, headline?, ... })` → approval
- `update_fb_budget({ entity_id, level: 'campaign'|'adset', daily_budget })` → approval
- `pause_fb_entity({ entity_id, level })` / `resume_fb_entity(...)` → approval
- `schedule_fb_toggle({ entity_id, level, action: 'pause'|'resume', cron_or_datetime })` → approval

### Google Ads
- `create_google_campaign(...)`, `update_google_budget(...)`, `pause_google_campaign(...)`, `resume_google_campaign(...)`, `schedule_google_toggle(...)` — אותם דפוסים, דרך Google Ads API v23

### אופטימיזציה
- `analyze_and_suggest_optimization({ campaign_id, days })` — מחזיר המלצות (תקציב/יצירתי/קהל) **בלי לבצע**, רק מציע. כרמן מציגה בוואטסאפ ומבקשת אישור לכל שינוי כצעד נפרד.

## 3. תזמון אוטומטי (Pause/Resume בלוח זמנים)

**טבלה חדשה** `campaign_schedules`:
- `id`, `tenant_id`, `client_id`, `entity_id`, `entity_type` (`fb_campaign`|`fb_adset`|`fb_ad`|`google_campaign`)
- `action` (`pause`|`resume`)
- `cron_expression` (לחזרתיות) או `run_at` (חד-פעמי)
- `timezone`, `enabled`, `last_run_at`, `next_run_at`
- `created_by`, `approved_at`
- RLS + GRANT

**Edge Function חדש** `campaign-scheduler-cron` (כל 5 דקות):
- שואב רשומות ב-`campaign_schedules` שה-`next_run_at` שלהן הגיע
- מבצע pause/resume דרך `fb-campaign-control` או Google Ads API
- מעדכן `last_run_at`, מחשב `next_run_at` מה-cron
- שולח התראה לכרמן/וואטסאפ על הביצוע

`pg_cron` יקרא לפונקציה כל 5 דקות.

## 4. זרימת אישור בוואטסאפ (קיימת — נשתמש בה)

לכל כלי mutating:
1. כרמן קוראת לכלי → הכלי **לא מבצע**, אלא יוצר רשומה ב-`agent_approval_queue` עם `payload` מלא
2. כרמן שולחת לוואטסאפ סיכום: "אני עומדת לכבות קמפיין X מ-22:00. לאשר? כן/לא"
3. תשובה "כן" → ה-webhook (`manus-wa-webhook`) מזהה approval, מבצע את הפעולה, שולח אישור ביצוע
4. "לא" → דוחה, מנקה מהתור

## 5. קבצים שיתווספו / ישתנו

**חדש:**
- `supabase/functions/carmen-save-media/index.ts`
- `supabase/functions/carmen-fb-tools/index.ts` (create campaign/adset/ad/lead-form)
- `supabase/functions/carmen-google-tools/index.ts`
- `supabase/functions/campaign-scheduler-cron/index.ts`
- מיגרציות: `marketing_media_library`, `campaign_schedules`, bucket `carmen-media` + RLS
- אינסרט נפרד (לא מיגרציה): `cron.schedule(...)` ל-`campaign-scheduler-cron`

**עריכה:**
- `supabase/functions/_shared/skills/registry.ts` — רישום כל הכלים החדשים עם regex triggers בעברית
- `supabase/functions/_shared/mcp-tools.ts` — מימוש ה-tool definitions
- `supabase/functions/_shared/carmen-prompt-v2.ts` — הוספת סקציה `buildAdOpsCapabilities()` שמסבירה לכרמן שהיא **כן** יכולה לבצע את כל הפעולות, ושהזרימה היא: הצעה → אישור בוואטסאפ → ביצוע
- `supabase/functions/manus-wa-webhook/index.ts` — זיהוי תשובת approval ("כן"/"לא"/"אשר") כשיש פריט פתוח ב-`agent_approval_queue` למשתמש

## 6. סקופ ובטחון
- כל הכלים מסוננים לפי tenant + role (קמפיינר → רק לקוחות שלו, manager → סוכנות)
- שום פעולה לא מתבצעת בלי `approved_at` ב-`agent_approval_queue`
- כל פעולת mutate נכתבת ל-`agent_action_log` עם payload מלא + תוצאה

## 7. שלבי הוצאה לפועל
1. מיגרציה: `marketing_media_library` + bucket + `campaign_schedules`
2. `carmen-save-media` + רישום ב-skills registry
3. `carmen-fb-tools` (create campaign/adset/ad + lead form swap + budget/pause/resume)
4. `campaign-scheduler-cron` + pg_cron
5. `carmen-google-tools` (אותם דפוסים)
6. עדכון `carmen-prompt-v2` + flow אישור ב-`manus-wa-webhook`
7. בדיקות end-to-end בוואטסאפ

## הערות
- אם החיבור Meta של הלקוח לא קיים — הכלי יחזיר שגיאה ידידותית וכרמן תבקש מהמשתמש לחבר ב-Integrations.
- שמירת מדיה תומכת רק בפורמטים נתמכים ל-Meta (jpg/png/mp4) — אחרים יסומנו `not_ad_ready`.
