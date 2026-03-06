

## תיקון: הדיאלוג מציג "אין קבוצה מקושרת" למרות שיש קבוצה

### הבעיה
הדיאלוג בודק רק את `notification_group_link` ברמת הערוץ, אבל הקבוצה מוגדרת ברמת הפרופיל (priority 4 בלוגיקה של ה-Edge Function). לכן הדיאלוג מציג בטעות "אין קבוצה מקושרת".

### פתרון
**`src/pages/TeamChat.tsx` — `NotifyTargetDialog`:**
- הרחבת הבדיקה: בנוסף ל-`channelHasGroupLink`, בדוק גם אם יש `notify_override_group` ברמת חברי הערוץ או `notification_group_link` ברמת הפרופילים
- כבר יש `memberProfiles` query שמביא את הפרופילים — נוסיף בדיקה האם לפחות אחד מהם מכיל `notification_group_link`
- נשנה את ה-prop ל-`channelHasGroupLink` כך שייקח בחשבון גם קבוצות פרופיל
- הכפתור "שלח לקבוצה" יהיה פעיל אם יש קבוצה בכל אחד מהמקורות
- אם אין קבוצה בשום מקום — רק אז נציג "(אין קבוצה מקושרת)"

### שינוי ספציפי
1. ב-`NotifyTargetDialog` — חישוב `hasAnyGroupLink` שבודק: channel group link **או** member override group **או** profile notification_group_link
2. הוספת fetch של `notify_override_group` מ-`team_channel_members` (כבר זמין ב-members data)
3. שימוש ב-`hasAnyGroupLink` במקום `channelHasGroupLink` לתצוגה ולכפתור disabled

