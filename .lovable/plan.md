

## תוכנית: מודול תקשורת פנים-ארגונית (סגנון Slack)

### סקירה
מודול חדש לתקשורת פנימית בין חברי הארגון, עם ערוצים/קבוצות, הודעות בזמן אמת, שיוך לקוחות/לידים/משימות, והעלאת קבצים.

### שלב 1 - טבלאות בסיס נתונים (Migration)

**`team_channels`** - קבוצות/ערוצים
- `id`, `tenant_id`, `name`, `description`, `color` (צבע מותאם), `avatar_url`, `created_by` (user_id), `is_private`, `linked_client_id`, `linked_lead_id`, `created_at`

**`team_channel_members`** - חברי קבוצה
- `id`, `channel_id`, `user_id`, `role` (admin/member), `joined_at`
- RLS: רק חברי הקבוצה רואים את החברות

**`team_messages`** - הודעות
- `id`, `channel_id`, `tenant_id`, `sender_id` (user_id), `content`, `parent_message_id` (threads), `created_at`, `updated_at`, `is_edited`
- RLS: רק חברי הקבוצה רואים הודעות
- Realtime enabled

**`team_message_attachments`** - קבצים מצורפים
- `id`, `message_id`, `file_url`, `file_name`, `file_type`, `file_size`, `linked_client_id`, `linked_lead_id`

**`team_message_reactions`** - תגובות אמוג'י
- `id`, `message_id`, `user_id`, `emoji`

**`team_message_read_status`** - סטטוס קריאה
- `channel_id`, `user_id`, `last_read_message_id`, `last_read_at`

Storage bucket: `team-attachments` (public)

RLS policies ישתמשו בפונקציית `is_channel_member(channel_id, user_id)` (SECURITY DEFINER) למניעת רקורסיה.

### שלב 2 - הרשאות

- הוספת `team_chat` למודולים ב-`src/lib/modules.ts` (קטגוריית main)
- Route חדש ב-`App.tsx`: `/t/:tenantSlug/team-chat`
- הרשאת גישה דרך ProtectedRoute עם `requiredPermission="team_chat"`

### שלב 3 - דף ראשי `TeamChat.tsx`

layout בסגנון Slack:
- **סרגל צד שמאלי**: רשימת ערוצים + כפתור "צור קבוצה חדשה"
- **אזור מרכזי**: הודעות הערוץ הנבחר + שדה כתיבה
- **סרגל ימני** (אופציונלי): פרטי ערוץ, חברים, קבצים משויכים

### שלב 4 - רכיבים

1. **`CreateChannelDialog`** - יצירת קבוצה חדשה
   - שם, תיאור, צבע (color picker), תמונת פרופיל (upload) או אווטר AI
   - בחירת חברים מתוך משתמשי הארגון
   - אפשרות שיוך ללקוח/ליד

2. **`ChannelSidebar`** - רשימת ערוצים עם badge של הודעות שלא נקראו

3. **`TeamMessageList`** - רשימת הודעות עם:
   - תמונת פרופיל שולח
   - תמיכה ב-threads (תגובות על הודעה)
   - תגובות אמוג'י
   - קבצים מצורפים

4. **`TeamMessageInput`** - שדה כתיבה עם:
   - אפשרות העלאת קבצים
   - שיוך קובץ ללקוח/ליד
   - יצירת משימה מהודעה

5. **`ChannelSettingsDialog`** - הגדרות ערוץ
   - ניהול חברים (הוספה/הסרה)
   - שינוי צבע ותמונה
   - שיוך ללקוח/ליד

6. **`CreateAvatarDialog`** - יצירת אווטר ב-AI
   - שימוש ב-`google/gemini-2.5-flash-image` ליצירת אווטר
   - שמירה ל-storage bucket

### שלב 5 - Realtime

הפעלת Realtime על `team_messages` לקבלת הודעות חדשות בזמן אמת.

### שלב 6 - Edge Function ליצירת אווטר AI

`generate-team-avatar` - מקבל prompt מהמשתמש, יוצר תמונה דרך Lovable AI, מעלה ל-storage ומחזיר URL.

### פרטים טכניים
- כל הטבלאות עם `tenant_id` ו-RLS מלא
- פונקציית SECURITY DEFINER: `is_channel_member(p_channel_id uuid, p_user_id uuid)` שבודקת חברות בקבוצה
- הודעות נטענות לפי תקופה (7 ימים) עם "טען עוד" כמו במודול הצ'אט הקיים
- כל משתמש בארגון יכול ליצור קבוצה (היוצר הופך ל-admin)
- Storage bucket עם RLS שמאפשר רק לחברי הקבוצה גישה לקבצים

### סדר יישום מומלץ
בגלל הגודל, מומלץ לפצל ל-3 שלבים:
1. **שלב א'**: טבלאות + RLS + דף בסיסי עם ערוצים והודעות
2. **שלב ב'**: קבצים, threads, תגובות, שיוך ללקוח/ליד/משימה
3. **שלב ג'**: אווטר AI, realtime מלא, התראות

