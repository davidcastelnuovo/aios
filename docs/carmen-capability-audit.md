# ביקורת יכולות כרמן — "כל מה שדוד עושה במערכת"

> **מטרה:** כרמן צריכה להיות מסוגלת לבצע את כל מה שדוד (owner) עושה בעצמו בממשק — במודולים המרכזיים. מסמך זה הוא ביקורת מבוססת-קוד: פעולות UI מול כלי `run-ai-agent`, עם סטטוס כיסוי + פערי עדיפות.
>
> **עקרון בטיחות (כפי שהוגדר):** פעולות קריאה — חופשי. פעולות כתיבה/ניהול על חשבונות פרסום (Meta/Google) ופעולות רגישות אחרות — **רק באישור ובהוראה ישירה**. כרגע: חלק דרך `agent_approval_queue`, חלק דרך `confirmed=true` מיידי (בעייתי).
>
> מקורות: `src/` (UI), `supabase/functions/run-ai-agent/index.ts`, `carmen-approval-execute`. תאריך: 2026-07-31.
>
> מסמך נלווה לחזון ארוך-טווח: `docs/carmen-ceo-roadmap.md`.

---

## 0. תקציר מנהלים

| מודול | כיסוי | פסק דין |
|---|---|---|
| **משימות** | ~85% | כמעט מלא — פערי sync יומן בעדכון, באג status |
| **זימונים / יומן** | ~80% | עובד — חסר זימון רב-משתתפים כמו ב-UI |
| **דוחות / דשבורד / דופק** | ~55% | קריאה טובה — חסר sync טבלאות, ייצוא PDF/CSV |
| **אוטומציות** | ~35% | list/toggle/propose — **אין עריכה/מחיקה/בדיקה** |
| **כספים (הנהלת חשבונות)** | ~10% | **פער קריטי** — הכלים נוגעים בטבלת `finance` הישנה, לא במודול האמיתי |
| **שיווק במערכת** | ~40% | CRM/דיוור/Maskyoo חלקי; **מחלקת שיווק (קופי/קריאייטיב/SEO/PBN) — אפס כלים** |
| **Meta Ads** | ~70% קריאה / ~60% כתיבה | קריאה חיה טובה; כתיבה קיימת אבל **שני נתיבים** (queue vs confirmed מיידי) |
| **Google Ads** | ~40% | list accounts + pause/resume/budget באישור; **אין list campaigns / יצירה / sync** |

**המלצת סדר תיקון (לפי ערך מיידי ל"כל מה שאני עושה"):**
1. **כספים** — לחבר את כרמן למודול הנהלת החשבונות האמיתי
2. **איחוד נתיב אישור Meta/Google** — הכל דרך `agent_approval_queue` בלבד (כפי שביקשת)
3. **Google Ads קריאה** — `list_google_campaigns` + sync דוחות
4. **אוטומציות** — עריכה/מחיקה/הרצה באישור
5. **דוחות** — `sync_facebook_insights` / `sync_google_ads` + ייצוא
6. **מחלקת שיווק** — כלים ל-`marketing_work_items` / pipeline
7. **פערי משימות/זימונים קטנים**

---

## 1. משימות

### מה דוד עושה ב-UI
`Tasks.tsx` / `WeeklyTaskBoard` / `TaskDetailDialog`: יצירה, עריכה, סטטוס, עדיפות, שיוך לקוח/קמפיינר/ליד, גרירה לתאריך, הערות+קבצים, שיתוף פעולה (`task_collaborators`), מחיקה, סנכרון ליומן Google, יצירה מאירוע יומן.

### מה כרמן יכולה היום

| פעולה | כלי | סטטוס |
|---|---|---|
| יצירת משימה | `create_task` | ✅ (+ auto calendar אם due_date+due_time) |
| רשימה / חיפוש | `list_tasks`, `search_tasks` | ✅ |
| עדכון שדות / סטטוס | `update_task`, `update_task_status` | ✅ |
| מחיקה | `delete_task` | ✅ |
| הערה | `add_task_update` | ✅ |
| שיתוף פעולה | `manage_task_collaborators` | ✅ (חסר list) |
| תעדוף | `prioritize_tasks` | ✅ (המלצה בלבד) |
| בעלות סוכן | `take_task`, `complete_task_step` | ⚠️ באג: `complete_task_step` כותב status=`done` במקום `completed` |
| משימות עצמיות | `create_agent_task`, `list_my_agent_tasks` | ⚠️ אין עדכון/ביטול |

### פערים
1. **`update_task` לא מסנכרן יומן** כשמשנים תאריך/שעה (רק `create_task` מסנכרן).
2. באג `complete_task_step` → status `'done'` vs enum `'completed'`.
3. אין list collaborators / אין update/cancel ל-`agent_tasks`.
4. אין העלאת קבצים להערת משימה (UI תומך attachments).

---

## 2. זימונים / יומן Google

### מה דוד עושה ב-UI
`ClientMeetingTab` / `useMeetingScheduler`: זימון עם מספר משתתפים (אנשי קשר לקוח + צוות), מיקום, הודעה אישית, עדכון שדות ליד, טריגר אוטומציה `meeting_created`. פרופיל: חיבור OAuth, שיתוף יומן, אירועים ידניים.

### מה כרמן יכולה היום

| פעולה | כלי | סטטוס |
|---|---|---|
| שליחת זימון במייל | `send_calendar_invite` | ✅ (משתתף אחד; Asia/Jerusalem תקין) |
| רשימת אירועים | `list_calendar_events` | ✅ |
| עדכון זימון | `update_calendar_invite` | ✅ |
| ביטול זימון | `cancel_calendar_invite` | ⚠️ תיאור אומר "בקשי אישור" — **אין אכיפת `confirmed` בקוד** |
| סנכרון משימה→יומן | דרך `create_task` | ✅ (בלוק פנימי, בלי attendees) |

### פערים
1. אין זימון **רב-משתתפים** (רשימת emails) כמו ב-UI.
2. אין טריגר `meeting_created` אחרי זימון של כרמן.
3. `cancel_calendar_invite` בלי אכיפת אישור בקוד.
4. אין חיבור/ניתוק OAuth (סביר שישאר ידני).

---

## 3. דוחות / דשבורד / דופק / התראות

### מה דוד עושה ב-UI
`Dashboard`, `DMMDashboard`, `DynamicTables`/`DynamicTableView`, `CampaignAlerts`: צפייה ב-KPIs, דופק בריאות לקוחות, טבלאות דוחות FB/Google/GA/GSC/SEO, סנכרון נתונים, ייצוא PDF/CSV, שיתוף לינק, שליחת דוח בוואטסאפ/מייל, ניהול התראות, AI analysis על טבלה.

### מה כרמן יכולה היום

| פעולה | כלי | סטטוס |
|---|---|---|
| סטטיסטיקות כלליות | `get_dashboard_stats` | ✅ (ספירות בלבד) |
| דופק קמפיינים | `get_latest_campaign_pulse` | ✅ (snapshot מוכן; לא live) |
| ניתוח ביצועים | `analyze_campaign_performance` | ✅ |
| ניתוח FB חי | `get_facebook_campaign_data`, `analyze_facebook_campaign` | ✅ |
| התראות | `get_campaign_alerts`, `acknowledge_campaign_alert` | ⚠️ אין resolve |
| בריאות חשבונות | `check_ad_accounts_health` | ✅ |
| חיבור טבלת FB ללקוח | `create_facebook_report_table` | ⚠️ יוצר טבלה — **לא מריץ sync ראשוני** |
| כיבוי/הדלקת טבלת קמפיין | `set_campaign_table_active` | ✅ |

### פערים
1. **אין `sync_facebook_insights` / `sync_google_ads_data`** — כרמן לא יכולה לרענן דוחות כמו כפתור הסנכרון ב-UI.
2. **אין ייצוא PDF/CSV / שליחת דוח** (UI: `downloadReportPdf`, `SendReportDialog`).
3. אין יצירת טבלת Google Ads / GA / GSC.
4. אין `resolve_campaign_alert`.
5. אין גישה ל-DMM health score הידני (`ManualHealthEditDialog`) מעבר ל-`update_client_health` (mood בלבד).

---

## 4. אוטומציות

### מה דוד עושה ב-UI
`Automations` / `FlowEditor`: יצירה (פשוט + ויזואלי), עריכת צעדים, הפעלה/כיבוי, מחיקה, שכפול, שיתוף לטננט, בדיקה (`TestAutomationDialog` / manual trigger), היסטוריית הרצות.

### מה כרמן יכולה היום

| פעולה | כלי | סטטוס |
|---|---|---|
| רשימה | `list_automations` | ⚠️ בלי צעדי flow |
| הפעלה/כיבוי | `toggle_automation` | ✅ (בלי approval — לשקול) |
| הצעת אוטומציה חדשה | `propose_automation` → queue → `carmen-approval-execute` | ✅ (לינארית, נוצרת **כבויה**) |
| טפסי ליד Meta | `inspect_meta_lead_forms`, `set_automation_meta_lead_form`, `create_meta_lead_form` | ✅ (`confirmed` + manager) |

### פערים (גדולים)
1. **אין עריכת אוטומציה קיימת** (`propose_automation_edit`).
2. **אין מחיקה / שכפול**.
3. **אין הרצה/בדיקה** (test / manual trigger).
4. `list_automations` לא מחזיר steps — קשה לכרמן "לראות" מה האוטומציה עושה.
5. `toggle_automation` בלי approval gate (לשקול — כיבוי בטעות מסוכן).

---

## 5. כספים — פער קריטי 🔴

### מה דוד עושה ב-UI
מודול **הנהלת חשבונות** (`AccountingIntegrations`): retainers, הכנסות חד-פעמיות (`one_time_incomes`), תשלומי הכנסה/הוצאה (`income_payments` / `expense_payments`), תזרים חודשי + ייצוא CSV, העלאת חשבוניות OCR (`invoice_uploads`), עדכון סטטוס לקוח.

מסלול יתום `/finance` קורא מטבלת `finance` — **לא המודול הראשי**.

### מה כרמן יכולה היום

| פעולה | כלי | סטטוס |
|---|---|---|
| list/create/summary | `list_finance`, `create_finance_entry`, `get_finance_summary` | ❌ **נוגעים רק בטבלת `finance` הישנה** — לא בנתונים שדוד רואה בהנהלת חשבונות |

### פערים (חובה לתקן)
1. ~~אין כלים ל-`one_time_incomes` / `income_payments` / `expense_payments` / retainers.~~ → **WP1 נסגר** (`get_accounting_overview` + list/create tools; כתיבה דרך queue).
2. ~~אין תזרים חודשי~~ → מכוסה חלקית ב-`get_accounting_overview`.
3. **אין העלאת חשבוניות** (`invoice_uploads` upload) — יש `list_invoice_uploads` לקריאה.
4. אין ייצוא CSV.
5. ~~סקין CFO מפנה לכלים שלא קיימים~~ → עודכן ב-migration `20260731190000`.

---

## 6. שיווק במערכת (מחלקת שיווק + CRM + דיוור)

### 6.1 CRM לקוחות / לידים — כיסוי טוב

| פעולה | כלי | סטטוס |
|---|---|---|
| CRUD לקוחות/לידים | `create/list/update/delete_*`, statuses, updates | ✅ |
| בריאות לקוח | `update_client_health` | ✅ (mood + communication_logs) |
| חיפוש ישויות | `search_entities` | ✅ |
| שיוך קמפיינר↔לקוח (`client_team`) | — | ❌ **אין כלי** (רק קריאה דרך filter ב-`list_clients`) |

### 6.2 דיוור — כיסוי טוב עם אישור

| פעולה | כלי | סטטוס |
|---|---|---|
| יצירת טיוטה | `create_broadcast` | ⚠️ soft-ask; באג `created_by` null |
| שליחה/תזמון/ביטול | `send_broadcast_now`, `schedule_broadcast`, `cancel_broadcast` | ✅ דרך approval queue |
| רשימה / קבוצות WA | `list_broadcasts`, `list_wa_groups` | ✅ |

### 6.3 Maskyoo / שיחות SEO

| פעולה | כלי | סטטוס |
|---|---|---|
| דוח שיחות | `get_maskyoo_calls_report` | ⚠️ snapshots בלבד; fallback ל-`call_logs` לא ממומש |
| סנכרון CDR | `sync_maskyoo_cdr` | ✅ |

### 6.4 סושיאל

| פעולה | כלי | סטטוס |
|---|---|---|
| טיוטה / פרסום | `create_social_post`, `publish_social_post` | ✅ (publish עם `confirmed`) |
| עמודים / תגובות | `list/sync_social_pages`, comments reply/hide | ✅ |
| מדיה | `save_media_from_chat`, `list_client_media` | ⚠️ אין delete / ad_ready |

הערה: רכיבי UI של סושיאל (`social-media/*`) קיימים בקוד אבל **לא מחוברים לניווט** — כרמן כאן מקדימה את הממשק.

### 6.5 מחלקת שיווק (קופי / קריאייטיב / SEO / Publishing) — פער גדול 🔴

UI ב-`MarketingDepartment` + `CopyDepartment` / `CreativeDepartment` / `SeoGeoDepartment` / `PublishingStudio` עובד על `marketing_work_items`, `marketing_assets`, `marketing_pipeline_stages`, `publishing_*`.

**אפס כלים ב-`run-ai-agent` לטבלאות האלה** (אומת ב-grep). כרמן יכולה לכתוב קופי דרך סקין `copywriter` כטקסט בצ'אט — אבל לא ליצור/לקדם work item בפייפליין, לא למסור לקריאייטיב, לא לנהל PBN/מאמרים כמו ב-Publishing Studio.

**תיקון מומלץ:**
- `list_marketing_work_items` / `create_marketing_work_item` / `update_work_item_stage`
- `handoff_to_stage(item_id, stage)` 
- `list_publishing_tasks` / `generate_publishing_article` (כבר יש edge functions נפרדים — לחשוף ככלים)

---

## 7. Meta / Facebook Ads

### מה דוד עושה ב-UI
חיבור OAuth, טפסי ליד+מיפוי, יצירת טבלאות דוח + sync, התראות, שיוך עמודים. יצירת קמפיין קיימת ב-`CampaignLauncher` אבל **לא ב-route חי**. **אין ב-UI pause/budget** בטבלאות הדוח — כרמן כאן *עשירה יותר* מהממשק.

### מה כרמן יכולה היום

#### קריאה (חופשי — תקין לפי הדרישה)
| כלי | מה עושה |
|---|---|
| `list_facebook_ad_accounts` | חשבונות מחוברים |
| `list_facebook_campaigns` | קמפיינים (live Graph קודם) |
| `get_facebook_campaign_data` | insights חיים |
| `analyze_facebook_campaign` | ניתוח עמוק |
| `check_ad_accounts_health` | בריאות |
| `create_facebook_report_table` | חיבור לטבלת CRM |

#### כתיבה — **שני נתיבים (בעיה)**

| נתיב | כלים | התנהגות |
|---|---|---|
| **A — `confirmed=true` מיידי** | `toggle_facebook_campaign`, `update_facebook_budget`, `duplicate_facebook_campaign` | מבצע **מיד** אחרי confirmed בצ'אט — **בלי** שורת approval queue |
| **B — `agent_approval_queue`** | `fb_create_campaign`, `fb_create_adset`, `fb_create_creative_from_media`, `fb_create_ad`, `fb_replace_lead_form`, `fb_update_budget`, `fb_pause`, `fb_resume`, `schedule_campaign_toggle` | ממתין לאישור מפורש → `execute_pending_approval` |

### פערים מול הדרישה שלך ("רק באישור והוראה ישירה")
1. **נתיב A עוקף את תור האישורים** — צריך לכבות/להפנות ל-queue (או למחוק את הכלים הישנים).
2. אין `sync_facebook_insights` אחרי יצירת טבלה.
3. אין list adsets/ads/creatives לקריאה מלאה לפני ניהול.
4. אין עריכת targeting/קופי מודעה (רק יצירה דרך queue).

**פעולה מומלצת מיידית:** deprecate נתיב A — `toggle_facebook_campaign` / `update_facebook_budget` / `duplicate_facebook_campaign` יהפכו ל-wrappers שמכניסים ל-queue כמו `fb_*`, או יוסרו מ-`ALL_TOOLS` ויישאר רק `fb_*`.

---

## 8. Google Ads

### מה דוד עושה ב-UI
חיבור OAuth / Make, יצירת טבלת דוח + sync, צפייה במטריקות. יצירת קמפיין ב-`CampaignLauncher` (לא ב-route חי). **אין pause/budget ב-UI.**

### מה כרמן יכולה היום

| פעולה | כלי | סטטוס |
|---|---|---|
| רשימת חשבונות | `list_google_ad_accounts` | ✅ |
| שיוך חשבון→לקוח | `connect_google_ads_account` | ✅ |
| pause / resume / budget | `gads_pause`, `gads_resume`, `gads_update_budget` | ✅ דרך approval queue — **תואם לדרישה** |
| רשימת קמפיינים | — | ❌ |
| יצירת קמפיין | — | ❌ |
| sync דוח | — | ❌ |
| יצירת טבלת CRM | — | ❌ |

### פערים
1. **`list_google_campaigns(customer_id)`** — חובה לקריאה לפני ניהול.
2. **`sync_google_ads_data`** / `create_google_ads_report_table`.
3. יצירת קמפיין (queue) — אופציונלי; UI עצמו כמעט לא חושף.

---

## 9. מטריצת כיסוי מרוכזת

| # | יכולת שדוד עושה | כרמן | Approval | עדיפות תיקון |
|---|---|---|---|---|
| 1 | CRUD משימות + הערות + collaborators | ✅ | — | נמוך (באגים קטנים) |
| 2 | סנכרון משימה↔יומן בעדכון תאריך | ❌ | — | בינוני |
| 3 | שליחת זימון למייל | ✅ | — | נמוך (רב-משתתפים) |
| 4 | צפייה בדופק/ניתוח קמפיינים | ✅ | — | — |
| 5 | סנכרון טבלת דוח FB/Google | ❌ | — | גבוה |
| 6 | ייצוא/שליחת דוח PDF | ❌ | — | בינוני |
| 7 | יצירת אוטומציה | ✅ (propose→queue) | queue | — |
| 8 | עריכה/מחיקה/בדיקת אוטומציה | ❌ | — | גבוה |
| 9 | הנהלת חשבונות (תזרים/תשלומים/retainers) | ❌ | — | **קריטי** |
| 10 | דיוור שליחה | ✅ | queue | נמוך (באג created_by) |
| 11 | מחלקת שיווק (קופי→קריאייטיב→SEO) | ❌ | — | גבוה |
| 12 | שיוך קמפיינר ללקוח | ❌ | — | בינוני (יש skin נפרד לfix) |
| 13 | צפייה בקמפיינים Meta | ✅ | — | — |
| 14 | ניהול Meta (pause/budget/create) | ✅ | ⚠️ dual path | **קריטי** (איחוד queue) |
| 15 | צפייה בקמפיינים Google | ❌ | — | גבוה |
| 16 | ניהול Google (pause/budget) | ✅ | queue | — |

---

## 10. תכנית תיקון ממוקדת (Work packages)

### WP0 — איחוד אישור Meta ✅ בוצע
- Legacy Meta mutate tools (`toggle_facebook_campaign` / `update_facebook_budget` / `duplicate_facebook_campaign`) → `agent_approval_queue` בלבד.
- `cancel_calendar_invite` אוכף `confirmed=true`.

### WP1 — כספים אמיתיים ✅ בוצע
- כלים: `get_accounting_overview`, retainer/payments/invoices list + write דרך queue.
- סקין CFO עודכן.

### WP2 — Google Ads קריאה + sync ✅ בוצע
- `list_google_campaigns`, `create_google_ads_report_table`, `sync_google_ads_report`, `sync_facebook_insights`.

### WP3 — אוטומציות ✅ בוצע
- `get_automation_details`; toggle/delete/edit דרך queue.

### WP4 — מחלקת שיווק ✅ בוצע
- `list/get/create/handoff/update_marketing_work_item`.

### WP5 — פוליש ✅ בוצע
- `complete_task_step` → status `completed`; `create_broadcast` created_by; sync יומן ב-`update_task`; `resolve_campaign_alert`.

---

## 11. איך לאמת (בלי לכתוב לדאטה בפרוד)

בדיקות מומלצות מול כרמן בוואטסאפ / Command Center (קריאה בלבד קודם):

1. **משימות:** "תראי לי משימות פתוחות של השבוע" → `list_tasks`.
2. **זימון:** "שלחי זימון בדיקה ל-[מייל שלי] מחר ב-10:00" → `send_calendar_invite` (רק אם מאשרים שליחה אמיתית).
3. **Meta קריאה:** "תראי לי קמפיינים של [לקוח]" → `list_facebook_campaigns` / `get_facebook_campaign_data`.
4. **Meta כתיבה:** "תעצרי את קמפיין X" → חייב ליצור שורת approval ולא לבצע מיד (אחרי WP0).
5. **Google:** "אילו חשבונות Google מחוברים?" → `list_google_ad_accounts`. "אילו קמפיינים?" → היום ייכשל/יחסר — אחרי WP2.
6. **כספים:** "מה התזרים החודש?" → היום יחזיר מ-`finance` הישן (שגוי/ריק) — אחרי WP1 ימשוך מהנהלת חשבונות.
7. **אוטומציות:** "אילו אוטומציות פעילות?" → `list_automations`. "תערכי את X" → היום אין כלי.
8. **שיווק:** "אילו עבודות קופי פתוחות?" → היום אין כלי.

---

*ביקורת מבוססת-קוד בלבד. אין שינוי יישום במסמך זה. מימוש לפי WP0→WP5 באישור.*
