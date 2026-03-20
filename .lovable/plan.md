

# תוכנית: שני מודים למערכת - AIOS וקלאסי

## רעיון מרכזי
המשתמש יוכל לבחור בין שני מודים:
- **מוד AIOS** - ממשק AI-first: צ'אט למעלה, נתונים דינמיים למטה, בלי סיידבר
- **מוד קלאסי** - הממשק הנוכחי כמו שהוא (סיידבר + דפים + ניווט רגיל)

המעבר בין המודים יהיה דרך כפתור בהדר / בפרופיל, והבחירה תישמר בבסיס הנתונים.

## שלבים

### שלב 1: תשתית מעבר בין מודים
- הוספת עמודה `ui_mode` לטבלת `profiles` (ברירת מחדל: `'classic'`)
- יצירת `UIModeContext` שמנהל את המוד הנוכחי ומספק `toggleMode()`
- כפתור מעבר בין המודים בהדר (אייקון toggle)

### שלב 2: דף AIOS Dashboard
- יצירת `AIOSDashboard.tsx` - הדף הראשי של מוד AIOS
- **חלק עליון**: `AIOSChatBar` - שורת קלט צ'אט קומפקטית עם היסטוריית הודעות
- **חלק תחתון**: `DataCanvas` - אזור תצוגה דינמי שמציג נתונים לפי בקשת המשתמש
- מצב ברירת מחדל: כרטיסי סיכום בסיסיים (משימות פתוחות, לידים חדשים, וכו')

### שלב 3: רכיב DataCanvas
- תמיכה בסוגי תצוגות: `table`, `cards`, `stats`, `list`
- כל תצוגה מוצגת ככרטיס נקי עם כותרת וכפתור סגירה
- ניתן להציג מספר כרטיסים במקביל

### שלב 4: הרחבת Edge Function הקיים
- עדכון `ai-support-chat` עם כלי `display_data` חדש
- הכלי מחזיר structured JSON שה-frontend יודע לרנדר ב-DataCanvas
- פורמט: `{ view_type, title, columns, data }`

### שלב 5: עדכון Layout ו-Routing
- `AppLayout` יבדוק את ה-`ui_mode`:
  - **classic**: הממשק הנוכחי ללא שינוי
  - **aios**: הסיידבר מוסתר, ההדר מינימלי, התוכן הוא `AIOSDashboard`
- ה-route `/t/:tenantSlug/dashboard` ירנדר את הדף המתאים לפי המוד
- כל שאר הדפים נשארים זמינים (גם במוד AIOS אפשר לנווט אליהם דרך הסוכן)

```text
מוד קלאסי:                    מוד AIOS:
┌──────┬──────────────┐       ┌──────────────────────┐
│      │  Header      │       │ Logo  [Toggle] Logout │
│ Side │──────────────│       │──────────────────────│
│ bar  │              │       │ [    שאל אותי כל דבר...   ] │
│      │   Page       │       │──────────────────────│
│      │   Content    │       │  ┌─────┐  ┌─────┐   │
│      │              │       │  │Card │  │Card │   │
│      │              │       │  │Data │  │Data │   │
└──────┴──────────────┘       └──────────────────────┘
```

## פרטים טכניים

### קבצים חדשים
- `src/contexts/UIModeContext.tsx` - ניהול מצב המוד
- `src/pages/AIOSDashboard.tsx` - דף ראשי AIOS
- `src/components/aios/AIOSChatBar.tsx` - שורת צ'אט
- `src/components/aios/DataCanvas.tsx` - מנוע תצוגת נתונים
- `src/components/aios/DataTable.tsx` - תצוגת טבלה
- `src/components/aios/DataCards.tsx` - תצוגת כרטיסים
- `src/components/aios/DataStats.tsx` - תצוגת סטטיסטיקות

### קבצים מעודכנים
- `src/components/layout/AppLayout.tsx` - בדיקת מוד + כפתור מעבר
- `src/App.tsx` - routing מותנה לפי מוד
- `supabase/functions/ai-support-chat/index.ts` - כלי display_data

### מיגרציה
```sql
ALTER TABLE profiles ADD COLUMN ui_mode text NOT NULL DEFAULT 'classic';
```

### סדר ביצוע
1. מיגרציה + UIModeContext + כפתור toggle
2. AIOSDashboard + AIOSChatBar (ממשק בסיסי)
3. DataCanvas עם סוגי תצוגות
4. עדכון Edge Function עם כלי display_data
5. חיבור SSE stream ל-DataCanvas
6. עדכון AppLayout לתמיכה בשני מודים

