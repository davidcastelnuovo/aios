המטרה: להריץ בדיקת קצה-לקצה למנגנון הניטור (פייסבוק + Google Ads), לקבל דוח אחד שמראה בדיוק כמה דוחות נסרקו וכמה תקלות זוהו, ולתקן באג קריטי שאיתרתי בלוגים.

## מה גיליתי בלוגים

ב-`trigger-automation` חוזרת שגיאה חוזרת:
```
invalid input value for enum automation_trigger: "account_stopped_spending"
```
ה-enum `automation_trigger` במסד הנתונים מכיל רק 18 ערכים — ואין בו `account_stopped_spending` ולא `ad_account_billing_issue`. כלומר: כל פעם שהקרון של פייסבוק או Google Ads מזהה קמפיין שעצר, ניסיון הפעלת האוטומציה נכשל בשקט. משימת ה-Carmen נוצרת, ההודעה הישירה ב-WhatsApp (ה-fallback שהוספנו) תעבוד — אבל מסלול האוטומציה מת. צריך לתקן.

## גילויים נוספים על Google Ads

ב-`cron-sync-google-ads` כבר קיימת אותה לוגיקה של Zero-Spend (יוצרת `anomaly_alert` + שולחת ל-`trigger-automation` עם אותו `account_stopped_spending`). מסלול הבעיות בחיוב חשבון לא קיים שם, אבל לפחות זיהוי קמפיין שעצר — קיים.

## תכנית הבדיקה והתיקון

1. **תיקון ה-enum (migration)**:
   - להוסיף ל-`automation_trigger` שני ערכים: `account_stopped_spending`, `ad_account_billing_issue`.
   - בלי זה, ההפעלה של האוטומציה תמיד תיכשל ולא נוכל לבדוק את המסלול הזה.

2. **Edge function חדש: `test-campaign-monitor`** (לא קרון, ידני בלבד):
   - קלט אופציונלי: `tenant_id` (אם לא — רץ על כל הטננטים).
   - שלב א': קורא ל-`cron-sync-facebook-insights` ו-`cron-sync-google-ads` בריצות חוזרות עד שכל הבטצ'ים מסתיימים (`has_more=false`).
   - שלב ב': אוסף תוצאות:
     - מספר דוחות פייסבוק שנסרקו / נכשלו.
     - מספר דוחות Google Ads שנסרקו / נכשלו.
     - כל המשימות `anomaly_alert` שנוצרו בשעה האחרונה (כותרת + תיאור + טננט).
     - כל ה-`crm_tables` שיש להם `integration_settings.account_status` השונה מ-`active` (תקלות חיוב/חשבון מושבת חיים, גם אם נוצרו לפני הריצה).
   - שלב ג': מחזיר JSON מסודר ושולח סיכום ב-WhatsApp לקמפיינר ראשי לכל טננט (אופציונלי, מאחורי דגל `notify=true`).
   - ייקרא ידנית פעם אחת אחרי הפריסה כדי לראות תוצאה אמיתית.

3. **הרצת הבדיקה והצגת התוצאה בצ'אט**:
   - אחרי הפריסה, אקרא ל-`test-campaign-monitor` עם `notify=false` בפעם הראשונה.
   - אציג כאן דוח: כמה דוחות פייסבוק ו-Google Ads נסרקו, מהן התקלות שזוהו (קמפיינים שעצרו, חשבונות עם בעיית חיוב), וכמה משימות `anomaly_alert` חדשות נוצרו.

## מה לא בתכנית (כדי לא לגדול מעבר לבקשה)
- לא משנה את התזמון של Google Ads (היום פעם ביום ב-04:00 UTC). אם תרצה גם אותו פעמיים ביום — נעשה אחרי שהבדיקה מצליחה.
- לא בונה UI חדש; הבדיקה מופעלת מהצ'אט בלבד.

## קבצים שייגעו
- `migration` חדש להרחבת `automation_trigger`.
- `supabase/functions/test-campaign-monitor/index.ts` חדש.