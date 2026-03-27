

## הבנת הבעיה: הדשבורד המשותף מציג נתונים חלקיים

### מה נראה במערכת הפנימית (DashboardView.tsx - 1,446 שורות)
כשבוחרים בלשונית **Analytics**, המערכת מציגה את הקומפוננטה `GoogleAnalyticsDashboard` המלאה שכוללת:
- **6 כרטיסי מדדים**: צפיות עמוד, סשנים, משתמשים, הוספה לעגלה, רכישות, שווי רכישות
- **גרפים**: מגמות יומיות, התפלגות תנועה לפי מקור
- **טבלאות מתקדמות**: פירוט לפי מקור הגעה, Traffic Acquisition לפי ערוץ
- **השוואה לתקופה קודמת**

בלשונית **הכל** מוצגים:
- 7 כרטיסי KPI (הוצאה, לידים, הכנסות, רכישות, ATC, ROAS)
- פירוט לפי פלטפורמה (טבלה מורחבת עם סשנים, סשנים ייחודיים)
- פירוט לפי מקור הגעה
- Traffic Acquisition לפי ערוץ
- גרפים: הכנסות מול הוצאות, ROAS יומי, ועוד

### מה נראה בקישור השיתוף (SharedDashboard.tsx - 485 שורות)
- **רק 2-4 כרטיסי מדדים** (ללא צפיות עמוד, סשנים, משתמשים, ATC)
- **אין `GoogleAnalyticsDashboard`** - כשבוחרים Analytics מוצגים רק כרטיסי רכישות והכנסות
- **אין גרפים** כלל (ללא מגמות יומיות, ללא הכנסות מול הוצאות)
- **אין פירוט לפי מקור הגעה**
- **אין Traffic Acquisition**
- **אין השוואה לתקופה קודמת**
- **טבלת פירוט לפי פלטפורמה** חסרה עמודות (סשנים, סשנים ייחודיים)
- **אין סיכום קמפיינים בפייסבוק**

### התוכנית: העתקת כל הלוגיקה מ-DashboardView ל-SharedDashboard

#### שינויים ב-`src/pages/SharedDashboard.tsx`:

1. **הוספת imports חסרים**: `recharts` (LineChart, ComposedChart, Bar, Area, etc.), `GoogleAnalyticsDashboard`

2. **הוספת מדדים חסרים ל-`summaryByPlatform`**: `users`, `addToCart` (כבר קיים חלקית), `leads`

3. **הוספת `globalAdsMetrics`** - חישוב הוצאות פרסום גלובלי כדי שלשונית Analytics תציג ROAS נכון

4. **הוספת `totalSummary` מורחב**: `analyticsSessions`, `analyticsUsers`, `analyticsAddToCart`, `leads`

5. **הוספת `allAnalyticsRecords`** - memo לכל רשומות ה-Analytics (ללא סינון report_type) עבור `GoogleAnalyticsDashboard`

6. **הוספת `analyticsSourceBreakdown`** - פירוט לפי מקור הגעה מצובר לפי קטגוריות

7. **הוספת `channelGroupBreakdown`** - Traffic Acquisition לפי ערוץ

8. **הוספת `dailyChartData`** - נתונים יומיים לגרפים

9. **הוספת `facebookCampaignSummary`** - סיכום קמפיינים בפייסבוק

10. **הוספת `campaignBreakdown`** - פירוט קמפיינים ללשונית "הכל"

11. **עדכון ה-JSX**:
    - כשבוחרים Analytics → להציג `GoogleAnalyticsDashboard` (בדיוק כמו בפנימי)
    - כשבוחרים "הכל" → 7 כרטיסי KPI, פירוט לפי פלטפורמה (מורחב), פירוט לפי מקור, Traffic Acquisition, גרפים
    - כשבוחרים Facebook → סיכום קמפיינים בטבלה
    - פירוט לפי פלטפורמה → הוספת עמודות סשנים וסשנים ייחודיים

בקיצור: **SharedDashboard צריך להיות כמעט זהה ל-DashboardView** (מינוס כפתור רענון, חזרה, שיתוף, ודשבורד סוכנות).

