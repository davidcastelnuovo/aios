

# הגדרת התראות ברמת ערוץ וברמת חבר בערוץ

## הבעיה הנוכחית
כרגע ההתראות מבוססות על `notification_group_link` ו-`phone` מטבלת `profiles` — כלומר ההגדרה היא גלובלית לכל המשתמש, לא ספציפית לערוץ. אין אפשרות להגדיר:
1. קבוצת וואטסאפ ייעודית **לערוץ ספציפי**
2. התראה **לחבר ספציפי** בערוץ (override של ההגדרה הגלובלית)

## מה ייבנה

### 1. שינויי Database (מיגרציה)

**טבלת `team_channels`** — הוספת עמודה:
- `notification_group_link text` — קישור לקבוצת וואטסאפ ייעודית לערוץ

**טבלת `team_channel_members`** — הוספת עמודות:
- `notify_enabled boolean DEFAULT true` — האם לשלוח התראה לחבר הזה בערוץ הזה
- `notify_override_phone text` — טלפון ספציפי לערוץ הזה (override)
- `notify_override_group text` — קבוצה ספציפית לערוץ הזה (override)

### 2. עדכון Edge Function `notify-team-message`

לוגיקת עדיפויות חדשה לכל חבר:
1. אם `notify_enabled = false` — דלג
2. אם יש `notify_override_group` על ה-member — שלח לקבוצה הזו
3. אם יש `notification_group_link` על הערוץ — שלח לשם (הודעה אחת, deduplicated)
4. אם יש `notify_override_phone` על ה-member — שלח לטלפון הזה
5. Fallback לפרופיל (`notification_group_link` / `phone` / campaigner phone)

### 3. UI — הגדרות התראות בערוץ

בתוך **ManageChannelMembersDialog** (או בדיאלוג הגדרות ערוץ), הוספת:

**ברמת ערוץ:**
- שדה "קבוצת וואטסאפ לערוץ" — כל ההתראות של הערוץ נשלחות לקבוצה אחת

**ברמת חבר:**
- Toggle "שלח התראות" (on/off) לכל חבר
- אפשרות להגדיר טלפון/קבוצה ספציפית לחבר בערוץ הזה (override)

### 4. קבצים שישתנו
- **מיגרציה SQL** — הוספת עמודות ל-`team_channels` ו-`team_channel_members`
- **`src/pages/TeamChat.tsx`** — UI להגדרות התראות בדיאלוג ניהול חברים + הגדרות ערוץ
- **`supabase/functions/notify-team-message/index.ts`** — לוגיקת עדיפויות חדשה
- **`src/integrations/supabase/types.ts`** — יתעדכן אוטומטית

