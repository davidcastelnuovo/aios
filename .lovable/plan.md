

# תוכנית: הצגת נתוני Traffic Acquisition בלשונית Analytics

## מה נבנה
בלשונית Analytics בדשבורד, נוסיף טבלת **Traffic Acquisition** שמציגה פירוט לפי Channel Group (כמו ב-GA4) עם מדדים: Sessions, Engaged Sessions, Engagement Rate, Average Engagement Time, Events per Session.

## שינויים נדרשים

### 1. עדכון Edge Function - `sync-google-analytics-data`
נוסיף **Report 5** חדש שמושך נתוני Traffic Acquisition לפי `sessionDefaultChannelGrouping`:

- **Dimensions**: `sessionDefaultChannelGrouping`
- **Metrics**: `sessions`, `engagedSessions`, `engagementRate`, `averageSessionDuration`, `eventsPerSession`, `totalUsers`, `ecommercePurchases`, `purchaseRevenue`
- נשמור כרשומות עם `report_type: 'channel_group'`
- נוסיף שדות חדשים ל-field definitions: `channel_group`, `engaged_sessions`, `engagement_rate`, `events_per_session`

### 2. עדכון הדשבורד - `DashboardView.tsx`
- נוסיף `useMemo` חדש שמסנן רשומות עם `report_type: 'channel_group'` ומבנה טבלת channel breakdown
- נציג טבלה חדשה **"טרפיק לפי ערוץ (Traffic Acquisition)"** בלשונית Analytics עם:
  - Channel Group (Paid Social, Organic Social, Direct, etc.)
  - Sessions
  - Engaged Sessions  
  - Engagement Rate (%)
  - Average Engagement Time
  - Events per Session
  - שורת סה"כ
- הטבלה תוצג גם בטאב "הכל" וגם בטאב "Analytics"

### 3. קבצים שישתנו
- `supabase/functions/sync-google-analytics-data/index.ts` — הוספת Report 5 (channel group)
- `src/pages/DashboardView.tsx` — הוספת טבלת Traffic Acquisition

### הערה
לאחר הפריסה, יש לרענן נתונים (כפתור "רענן נתונים") כדי שהנתונים החדשים יסונכרנו מ-GA4.

