המטרה: שכרמן תבדוק פעמיים ביום את הקמפיינים (פייסבוק כרגע) ותתריע בוואטסאפ כשקמפיין שרץ הפסיק להוציא כסף, נחסם, או כשחשבון המודעות נכנס לבעיית חיוב — תוך שימוש מלא בלוגיקה הקיימת ובלי לבנות מערכת מקבילה.

מה כבר קיים (לא לבנות מחדש):
- `cron-sync-facebook-insights` כבר עושה הכל פרט לתזמון ולהתראת חיוב חשבון:
  - מושך `effective_status` של כל קמפיין מפייסבוק (DISAPPROVED / WITH_ISSUES / PAUSED…).
  - מושך `account_status` ו-`disable_reason` של חשבון המודעות ושומר ב-`settings` של הטבלה.
  - מזהה Zero-Spend: קמפיין שהוציא >$5 ב-7 ימים קודמים והוציא 0 ב-2 הימים האחרונים → יוצר משימה ל-Carmen ב-`agent_tasks` עם `task_mode: 'anomaly_alert'`, ומפעיל את האוטומציה `account_stopped_spending` (שאמורה לשלוח WhatsApp).
  - מערכת `report_alerts` הקיימת בודקת `effective_status` מול קמפיינים ומפעילה אוטומציות `report_alert_triggered`.
- `agent-heartbeat` קוראת משימות `anomaly_alert` מ-24 השעות האחרונות, מצרפת אותן לסיכום ושולחת דייג'סט יומי בוואטסאפ ב-09:00 שעון ישראל לקמפיינר.

הפערים האמיתיים:
1. **תזמון לא נכון** — `sync-facebook-insights-weekly` רץ פעם בשבוע (`30 4 * * 0`), לא פעמיים ביום. זו הסיבה שהבדיקה לא קורית ואין התראות שוטפות (כולל NS Panel).
2. **אין התראה על בעיית חיוב/חשבון מושבת** — `account_status` ו-`disable_reason` נשמרים אבל לא נוצרת שום משימה/WhatsApp כש-`account_status` הופך ל-`unsettled` / `disabled` / `pending_settlement` / `closed`. זה בדיוק מה שפייסבוק שולח כש"יש בעיית תשלום".
3. **חוסר ודאות שהאוטומציה `account_stopped_spending` באמת שולחת WhatsApp** — צריך לבדוק שיש Automation פעילה עם הטריגר הזה לטננט; אם אין — נשלח WhatsApp ישירות מתוך הקרון (כמו ש-`agent-heartbeat` עושה ב-`send-whatsapp-message`) כ-fallback.

מה לעשות:

1) **לשנות את תזמון ה-cron לפעמיים ביום** (08:00 ו-20:00 שעון ישראל ≈ 06:00 ו-18:00 UTC):
   - להסיר את ה-job `sync-facebook-insights-weekly`.
   - ליצור job חדש `sync-facebook-insights-twice-daily` עם `0 6,18 * * *` שמפעיל את אותה edge function `cron-sync-facebook-insights`.

2) **להוסיף בדיקת תקינות חשבון מודעות (Account-level billing alert)** בתוך `cron-sync-facebook-insights` — מיד אחרי `accountStatus`/`accountDisableReason` הקיימים:
   - אם `accountStatus ∈ {disabled, unsettled, pending_settlement, pending_risk_review, closed}` ו-הסטטוס שונה מ-`settings.account_status` הקודם (כדי לא להציף):
     - יצירת משימת `agent_tasks` חדשה (`task_mode: 'anomaly_alert'`) עם כותרת בעברית כמו "🚨 בעיית חיוב/חשבון מודעות מושבת — {שם לקוח}" וגוף שמסביר את הסטטוס + `disable_reason`.
     - קריאה ל-`trigger-automation` עם `trigger_type: 'ad_account_billing_issue'` והפרמטרים הרלוונטיים.
     - **Fallback ישיר ל-WhatsApp**: לאחר היצירה, לקרוא ל-`send-whatsapp-message` עם הטלפון של הקמפיינר הראשי של אותו לקוח/טננט (אותה שליפה ש-`agent-heartbeat` עושה) עם הודעה תמציתית — כך שגם אם אין אוטומציה מוגדרת, ההתראה תגיע. שמירה idempotent: לא לשלוח שוב אם הסטטוס כבר היה זהה ב-`settings.account_status`.

3) **Fallback WhatsApp גם לבלוק ה-Zero-Spend הקיים** — אחרי הקריאה הקיימת ל-`trigger-automation` של `account_stopped_spending`, לבדוק אם קיימת אוטומציה כזו פעילה לטננט. אם לא, לשלוח WhatsApp ישיר לקמפיינר באותה שיטה. (מותנה — אפשר לוודא ידנית קיום האוטומציה לפני שמוסיפים, כדי לא לכפול הודעות.)

4) **שמירה על Idempotency** — שתי הריצות היומיות לא יכולות ליצור פעמיים את אותה משימה:
   - הקוד הקיים כבר בודק `agent_tasks` באותו title ב-24 שעות האחרונות. נשאיר את זה.
   - להתראת חשבון נשתמש בשינוי סטטוס כ-trigger, לא רק בקיומו.

5) **בדיקה אחרי הפריסה**:
   - הפעלת `cron-sync-facebook-insights` ידנית פעם אחת.
   - לוודא ש-`tenant_integrations.settings.account_status` של חשבון NS Panel מתעדכן.
   - לוודא שאם החשבון אכן במצב `unsettled`/`disabled` נוצרה משימת `anomaly_alert` ונשלחה הודעת WhatsApp.

ללא שינויי בסיס נתונים, RLS, או טבלאות חדשות. כל השינויים: עדכון ה-cron job + שינוי קובץ אחד `supabase/functions/cron-sync-facebook-insights/index.ts` + (אופציונלי) פונקציית עזר קטנה לשליפת הטלפון של הקמפיינר.