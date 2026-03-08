

# תוכנית ייצוב וחוסן למערכת Marketing Captain CRM

## מצב נוכחי

המערכת כבר פועלת כ-multi-tenant CRM על Lovable Cloud (Supabase) עם Edge Functions. המסמך שהגשת מתאר ארכיטקטורה אידיאלית עם message queues, worker pools, ו-event bus — אבל הסביבה שלנו (Supabase + Edge Functions) לא תומכת בתשתיות כמו Redis queues, worker pools נפרדים, או event bus מסורתי.

## מה אפשר ומה לא אפשר בסביבה הנוכחית

| דרישה | ישים בסביבה שלנו? | פתרון |
|--------|-------------------|-------|
| Rate limiting per tenant | ✅ | טבלת `tenant_rate_limits` + בדיקה ב-Edge Functions |
| Queues נפרדים | ⚠️ חלקי | טבלת `job_queue` עם `job_type` + priority |
| Worker pools | ❌ | Edge Functions הן stateless, אין workers קבועים |
| Event bus | ⚠️ חלקי | DB triggers + pg_net לקריאת Edge Functions |
| Circuit breaker | ✅ | טבלת `integration_health` עם failure counting |
| Idempotency | ✅ | טבלת `processed_events` עם unique key |
| Dead Letter Queue | ✅ | סטטוס `dead_letter` בטבלת jobs |
| Audit trail | ✅ | טבלת `audit_log` |
| Concurrency limits | ⚠️ חלקי | ספירת jobs פעילים per tenant |
| Max automation depth | ✅ | `execution_context` עם depth counter |

## תוכנית מימוש — 6 שלבים

### שלב 1: Job Queue + Rate Limiting
- טבלה `job_queue` עם: `id, tenant_id, job_type, priority, status, payload, attempts, max_attempts, created_at, started_at, finished_at, error`
- טבלה `tenant_rate_limits` עם: `tenant_id, resource_type, max_per_minute, current_count, window_start`
- Edge Function `process-job-queue` שמושכת jobs לפי priority ובודקת rate limits
- סטטוסים: `queued → running → done/failed/dead_letter`

### שלב 2: Idempotency + Circuit Breaker
- טבלה `processed_events` עם: `tenant_id, event_key (unique), processed_at`
- טבלה `integration_health` עם: `tenant_id, provider, consecutive_failures, last_failure_at, is_circuit_open, cooldown_until`
- כל Edge Function שמטפלת ב-webhook בודקת `processed_events` לפני עיבוד
- לפני קריאה ל-API חיצוני — בדיקת circuit breaker

### שלב 3: Automation Safety
- הוספת `execution_depth` ו-`execution_id` ל-trigger-automation
- הגבלת: `max_depth=10`, `max_actions=50`, `max_runtime=60s`
- זיהוי לולאות: אם אותו `entity_id + trigger_type` כבר רץ באותו `execution_id` → עצירה

### שלב 4: Audit Log
- טבלה `audit_log`: `tenant_id, user_id, action, entity_type, entity_id, before_data, after_data, created_at`
- DB trigger על טבלאות מפתח (leads, clients, tasks) שכותב שינויים אוטומטית

### שלב 5: Observability
- טבלה `system_metrics`: `tenant_id, metric_type, value, recorded_at`
- Edge Function `record-metrics` שנקראת מ-cron ומודדת: queue length, error rate, integration health
- דף admin חדש "System Health" שמציג את המטריקות

### שלב 6: High Load Mode
- הוספת `high_load_mode` boolean ל-tenant_settings
- כש-true: אוטומציות non-critical מושהות, exports חסומים, integrations מואטות
- הפעלה אוטומטית כש-queue length > threshold

## סדר עדיפויות

השלבים הכי קריטיים **עכשיו** (בהתחשב בבעיות העומס שחווית):
1. **שלב 1** (Job Queue) — מונע עומס על DB מפעולות כבדות
2. **שלב 3** (Automation Safety) — מונע לולאות שמפילות את המערכת
3. **שלב 2** (Circuit Breaker) — מונע קריאות חוזרות ל-APIs כושלים

## הערות טכניות

- כל הטבלאות החדשות יכללו `tenant_id` עם RLS policies
- Edge Functions ישתמשו ב-`pg_net` לקריאות אסינכרוניות (כפי שכבר קיים ב-`trigger_auto_sync_new_lead`)
- ה-cron job הקיים (`check-overdue-tasks`) יורחב למדידת מטריקות
- לא נשנה RLS policies קיימים — רק נוסיף טבלאות חדשות

