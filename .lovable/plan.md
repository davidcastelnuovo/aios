## הפעולות

### 1. מחיקת היסטוריית המשימות מהבוקר
מחיקה (DELETE) של כל ה-`agent_tasks` עם:
- `task_mode = 'anomaly_alert'`
- `title LIKE '🚨 חשבון פייסבוק עצר%'`
- `created_at::date = '2026-05-11'`

זה מנקה גם את 34 המשימות שסגרתי קודם וגם את 3 שכבר היו `done` (סה"כ 37). שימוש ב-insert tool עם DELETE.

### 2. הרצת בדיקה מיידית של סטטוס פייסבוק
הרצת `cron-sync-facebook-insights` עכשיו דרך `curl_edge_functions` (POST עם body ריק → רץ באצ' של 8 חשבונות). הקוד המעודכן:
- מתעלם מ-PAUSED/ARCHIVED/DELETED.
- יוצר משימות רק לפי `effective_status` רשמי: `DISAPPROVED`, `PENDING_BILLING_INFO`, `WITH_ISSUES` (עם `issues_info`).
- וגם משימת חשבון אם `account_status` בעייתי.

אם יש יותר מ-8 חשבונות, אצטרך לקרוא לפונקציה שוב עם `batch_offset` עד שכל החשבונות נסרקו.

לאחר מכן אדווח כמה משימות חדשות נוצרו (אם בכלל) — זה יראה לך אילו חשבונות באמת יש להם בעיה לפי הסיגנלים הרשמיים של פייסבוק.