

# ייצוא כל הטבלאות מהדאטהבייס

## מה ייעשה
ייצוא של כל 100+ הטבלאות מהדאטהבייס לקבצי CSV בתיקייה אחת, ארוזים בקובץ ZIP אחד להורדה.

## שיטה
סקריפט Python שירוץ ישירות (לא UI):
1. שליפת רשימת כל הטבלאות מ-`information_schema`
2. לכל טבלה — `COPY ... TO STDOUT WITH CSV HEADER` דרך `psql`
3. ארגון הקבצים בתיקייה `/mnt/documents/db_export/`
4. יצירת קובץ ZIP אחד: `/mnt/documents/db_export.zip`

## טבלאות (108 טבלאות)
כולל: agencies, clients, leads, tasks, campaigners, automations, chat_messages, finance, products, suppliers, ועוד.

## הערות
- טבלאות גדולות (כמו `chat_messages`, `site_events`) עלולות לקחת כמה שניות
- הייצוא כולל את כל הנתונים ללא סינון tenant
- קבצים ריקים יווצרו גם לטבלאות ריקות (עם שורת כותרת בלבד)

