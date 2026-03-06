

# תוכנית: עריכה/מחיקה של הודעות וערוצים + אווטר AI לערוצים

## סיכום
הוספת 3 יכולות לצ'אט הצוותי:
1. עריכה ומחיקה של הודעות (רק הודעות שלך)
2. עריכה ומחיקה של ערוצים (רק למנהלי הערוץ)
3. לחיצה על אווטר ערוץ → החלפת תמונה או יצירה ב-AI

---

## 1. עריכה ומחיקה של הודעות

**ב-`TeamMessageList`:**
- הוספת context menu (קליק ימני) או כפתורי hover על כל הודעה
- כפתור עריכה (עיפרון) + כפתור מחיקה (פח) — רק להודעות של המשתמש הנוכחי
- עריכה: הופכת את תוכן ההודעה ל-textarea inline, שמירה מעדכנת ב-DB ומסמנת `is_edited = true`
- מחיקה: דיאלוג אישור, ואז DELETE מ-`team_messages`
- הודעות שנערכו מציגות תווית "(נערך)"

## 2. עריכה ומחיקה של ערוצים

**ב-`ChannelHeader`:**
- הוספת כפתור הגדרות (⚙️) שנראה רק למנהלי הערוץ
- פותח דיאלוג `EditChannelDialog` עם:
  - שינוי שם, תיאור, צבע, קטגוריה
  - כפתור מחיקה (עם אישור) — מוחק ערוץ + הודעות + חברים

## 3. אווטר ערוץ עם AI

**ב-`ChannelHeader` ובדיאלוג עריכת ערוץ:**
- לחיצה על האווטר של הערוץ פותחת דיאלוג עם 2 אפשרויות:
  - **העלאת תמונה** — upload ל-storage bucket, שמירת URL ב-`avatar_url`
  - **יצירת אווטר ב-AI** — שדה prompt, קריאה ל-edge function שמשתמשת ב-`google/gemini-2.5-flash-image`, שמירת התוצאה ב-storage ועדכון `avatar_url`
- Edge function חדשה: `generate-channel-avatar` — מקבלת prompt, יוצרת תמונה, מעלה ל-storage, מחזירה URL
- הצגת ה-avatar_url בסיידבר ובהדר (אם קיים, במקום אייקון Hash/Lock)

---

## פרטים טכניים

### שינויי DB
- לא נדרשים שינויי סכמה — `team_channels.avatar_url` ו-`team_messages.is_edited` כבר קיימים

### קבצים לעריכה
- **`src/pages/TeamChat.tsx`** — כל השינויים (inline edit, delete message, edit/delete channel dialog, avatar dialog)

### Edge Function חדשה
- **`supabase/functions/generate-channel-avatar/index.ts`** — קריאה ל-Lovable AI Gateway עם `google/gemini-2.5-flash-image`, העלאת base64 ל-storage, החזרת URL

### Storage
- שימוש ב-bucket `team-chat-files` הקיים להעלאת אווטרים

