האבחנה: Manos לא עובד כי כרמן מפעילה `delegate_to_manus`, והקריאה ל-Manos מחזירה `Unauthorized` מהמפתח/הרשאה של Manus. אבל לבדיקת דופק בכלל לא צריך Manos — יש לכרמן כלי פנימי `analyze_campaign_performance`, ולכן הבעיה העיקרית היא בחירת כלי שגויה + הודעת רקע מטעה.

התוכנית לתיקון:

1. למנוע שימוש ב-Manos מתוך AIOS כברירת מחדל
   - ב-`supabase/functions/run-ai-agent/index.ts` לסנן גם את `delegate_to_manus` ב-`surface: 'aios'`, אלא אם המשתמש ביקש מפורשות להשתמש ב-Manos.
   - עבור `בדיקת דופק`, `בדיקת דוח`, `סיכום לקוחות`, `מצב קמפיינים` — כרמן תשתמש בכלים הפנימיים ולא ב-Manos.

2. להקשיח את הפרומפט של כרמן
   - ב-`supabase/functions/_shared/carmen-prompt-v2.ts` להוסיף כלל מפורש: בדיקת דופק/דוח/קמפיינים מבוצעת עם `analyze_campaign_performance`, לא עם `delegate_to_manus`.
   - לא לענות “אני עובדת ברקע” אם לא נוצרה בפועל משימת רקע עם `sub_task_id`.

3. לתקן את הודעת הרקע השקרית
   - ב-`run-ai-agent` להוסיף guard: אם התשובה אומרת שהתחילה עבודה ברקע אבל לא הופעל `delegate_to_subagent`/לא חזר `sub_task_id`, להחליף אותה בתשובה ברורה: “לא התחלתי משימת רקע; אני צריכה להריץ את הבדיקה ישירות/לפרק אותה”.
   - זה ימנע מצב שהצ׳אט מציג התקדמות שלא קיימת.

4. לתקן את כשל שמירת הזיכרון
   - שגיאת `there is no unique or exclusion constraint matching the ON CONFLICT specification` מגיעה מ-`save_memory` על `ai_memory`.
   - אוסיף מיגרציה עם unique index מתאים ל-`tenant_id, user_id, key`, או אתאים את ה-upsert למבנה הקיים — כדי שכרמן תוכל לזכור את ההנחיה “לא להשתמש ב-Manos לבדיקת דופק”.

5. לשפר את UI הכלים ב-AIOS
   - ב-`src/components/AIOSDialog.tsx` להציג תוויות ברורות יותר: `delegate_to_manus` כ-“מנסה לשלוח ל-Manos”, ו-`analyze_campaign_performance` כ-“בודקת ביצועי קמפיינים”.
   - אם יש `tool_result` עם שגיאה, להציג אותה קצר וברור במקום רק שורת “שולף זיכרון”.

6. פריסה ובדיקה
   - לפרוס את הפונקציות שהשתנו.
   - לבדוק שוב את התרחיש: “בדיקת דופק” צריך להפעיל `analyze_campaign_performance` ולהחזיר נתונים/כיסוי, בלי `delegate_to_manus` ובלי “עובדת ברקע” אם לא באמת נוצרה משימת רקע.

הערה על Manos עצמו: אם תרצי להשתמש ב-Manos למשימות חיצוניות באמת, כן צריך מפתח API תקין/מעודכן בהגדרות Manus. אבל לתיקון הנוכחי אני לא בונה על Manos — אני גורם לכרמן להשתמש בכלים שכבר קיימים במערכת.