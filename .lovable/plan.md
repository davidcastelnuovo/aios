# תכנית: יכולות ניהול קמפיינים לכרמן

הרחבת כרמן מ"קוראת בלבד" ל-**מנהלת קמפיינים אוטונומית** עם פיקוח אנושי על פעולות כספיות.

## 1. יכולות חדשות

### א. שליטה בקמפיינים (Write)
| יכולת | תיאור | אישור נדרש? |
|---|---|---|
| `pause_campaign` | השהיית קמפיין/אדסט/מודעה | לא (הפיך) |
| `activate_campaign` | הפעלה מחדש | כן (אם הושהה ע"י אדם) |
| `update_budget` | שינוי תקציב יומי/לכל החיים | **כן** — מעל ±20% או >₪500/יום |
| `duplicate_campaign` | שכפול קמפיין מנצח | כן |
| `update_bid_strategy` | שינוי אסטרטגיית הצעת מחיר | כן |

### ב. ניטור והתראות (Read + Push)
| התראה | טריגר | פעולה |
|---|---|---|
| **קמפיין נעצר** | `effective_status` ∈ {PAUSED, DISAPPROVED, WITH_ISSUES} ולא ע"י המשתמש | WhatsApp לקמפיינר + משימה |
| **מודעות לא מאושרות** | `ad.effective_status` = DISAPPROVED / PENDING_REVIEW > 24h | התראה + הצעה לערוך |
| **תקציב נגמר** | `budget_remaining` < 10% לפני סוף יום | התראה |
| **CPL חורג** | CPL יומי > 150% מהממוצע 7 ימים | התראה + הצעה להשהות |
| **Frequency גבוה** | frequency > 3.5 | הצעה לרענן יצירה |
| **CTR צונח** | ירידה > 30% מול 7 ימים | התראה |

### ג. ניתוח בזמן אמת והחלטות
- **`analyze_campaign_performance`** — משווה היום / 7 ימים / 30 ימים, מזהה trends
- **`recommend_action`** — מחזירה רשימת המלצות מדורגות (השהה X, הגדל תקציב Y ב-20%)
- **`auto_optimize`** (opt-in per tenant) — כרמן מבצעת אוטומטית פעולות "בטוחות": השהיית מודעות עם CPL פי 3 מהממוצע, הקטנת תקציב באדסטים מפסידים

## 2. ארכיטקטורה

```text
                    ┌─────────────────┐
   WA / Chat ──────►│  run-ai-agent   │
                    │  (Carmen tools) │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
   ┌──────────────┐  ┌──────────────┐ ┌──────────────┐
   │ fb-campaign- │  │ fb-campaign- │ │ fb-campaign- │
   │   control    │  │   analyze    │ │   monitor    │
   │ (write ops)  │  │  (read ops)  │ │   (cron)     │
   └──────┬───────┘  └──────────────┘ └──────┬───────┘
          │                                   │
          ▼                                   ▼
   Graph API v21                      campaign_alerts table
   + agent_approval_queue                     │
          │                                   ▼
          ▼                            send-wa-message
   agent_action_log                    (התראה לקמפיינר)
```

## 3. Edge Functions חדשים

1. **`fb-campaign-control`** (הרחבה של toggle-facebook-campaign הקיים)
   - פעולות: `pause`, `activate`, `update_budget`, `duplicate`, `update_bid`
   - כותב ל-`agent_action_log` כל פעולה עם before/after
   - לפעולות "מסוכנות" — דורש `approval_id` מ-`agent_approval_queue`

2. **`fb-campaign-analyze`**
   - מקבל `campaign_id` או `ad_account_id`
   - מחזיר metrics + trends + anomalies
   - משמש ככלי שכרמן קוראת לו לפני המלצות

3. **`fb-campaign-monitor`** (cron כל 30 דק׳)
   - סורק את כל הקמפיינים הפעילים בכל הטננטים
   - מזהה אנומליות → כותב ל-`campaign_alerts`
   - מפעיל את כרמן אוטונומית להגיב

## 4. שינויי DB

```sql
-- טבלת התראות קמפיינים
create table public.campaign_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  client_id uuid,
  campaign_id text not null,
  campaign_name text,
  alert_type text not null,         -- stopped|disapproved|cpl_spike|budget_low|frequency_high|ctr_drop
  severity text not null,           -- info|warning|critical
  details jsonb,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  created_at timestamptz default now()
);

-- הרחבת agent_approval_queue (כבר קיימת) לפעולות תקציב

-- tenant_settings: opt-in לאוטו-אופטימיזציה
-- settings.carmen_auto_optimize = boolean
-- settings.carmen_budget_change_threshold_pct = 20
```

## 5. כלי כרמן ב-`run-ai-agent`

```ts
{
  name: "list_facebook_campaigns",         // קיים
  name: "analyze_facebook_campaign",       // חדש - מטריקות + טרנדים
  name: "pause_facebook_campaign",         // קיים (toggle)
  name: "activate_facebook_campaign",      // קיים (toggle) - + needsApproval
  name: "update_facebook_budget",          // חדש - needsApproval מעל threshold
  name: "duplicate_facebook_campaign",     // חדש - needsApproval
  name: "get_campaign_alerts",             // חדש - שואב מ-campaign_alerts
  name: "acknowledge_alert",               // חדש
}
```

כל פעולה כותבת:
- `agent_action_log` — מי/מה/מתי/before/after
- WhatsApp confirmation לבעל הטננט / קמפיינר אחראי

## 6. UX בצ'אט

```
משתמש: כרמן מה מצב הקמפיינים?
כרמן: ⚠️ זוהו 3 בעיות:
  1. "פרומו - מכירות" — הושהה אוטומטית ע"י Meta (DISAPPROVED). אדאג שיתוקן?
  2. "קמפיין דצמבר" — CPL ₪87 (פי 2.3 מהממוצע). להשהות?
  3. אדסט "קהל חם" — frequency 4.2. לרענן יצירה?
  
משתמש: השהה את 2 והעלה תקציב של "קמפיין נובמבר" ב-30%
כרמן: ✅ "קמפיין דצמבר" הושהה.
      ⏸️ העלאת תקציב 30% (₪200→₪260) דורשת אישורך — אישור?
```

## 7. שלבי מימוש מומלצים

| שלב | תוכן | זמן |
|---|---|---|
| **1** | `fb-campaign-analyze` + כלי `analyze_facebook_campaign` בכרמן | מהיר |
| **2** | `update_budget` + `duplicate` + שכבת approvals | בינוני |
| **3** | טבלת `campaign_alerts` + cron `fb-campaign-monitor` | בינוני |
| **4** | UI: פאנל התראות בדשבורד CRM + acknowledge | בינוני |
| **5** | Auto-optimize opt-in + thresholds ב-settings | מהיר |

## פרטים טכניים

- Graph API v21.0, endpoints: `POST /{campaign_id}` (status, daily_budget), `POST /{adset_id}/copies` (duplicate)
- כל write דורש `ads_management` scope (כבר ב-OAuth שלנו)
- Rate limits: Meta מאפשר ~200 קריאות/שעה/user — נשתמש ב-batching
- כל פעולה idempotent עם `request_id` ב-`agent_action_log`
- מתחיל מ-Facebook; אותה ארכיטקטורה תיושם אח"כ ל-Google Ads (כבר קיימת אינטגרציה)

---

**שאלה לפני שמתחילים:** איזה שלב להתחיל איתו? אני ממליץ להתחיל מ-**שלב 1** (ניתוח + ניטור) ואז שלב 3 (מערכת התראות), לפני שנותנים לכרמן יכולות שינוי תקציב.