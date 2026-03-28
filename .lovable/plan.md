

## תיקון: חיבור Connection של Google Ads בסנריו המשוכפל

### הבעיה
כשהמערכת משכפלת סנריו מ-Make.com, היא מעדכנת את ה-Customer ID, Metrics ו-Webhook URL, אבל **לא מחליפה את ה-Connection** (החיבור ל-Google Ads) במודול. לכן הסנריו החדש נשאר עם החיבור הישן מה-Template.

### הפתרון
צריך לעדכן את ה-`connection` בכל מודול Google Ads בתוך ה-blueprint בעת השכפול, ולהעביר את ה-`connection_id` שהמשתמש בחר בדיאלוג יצירת הטבלה.

### שינויים נדרשים

**1. Edge Function `make-api/index.ts` - עדכון `clone_scenario`**
- בלולאה שעוברת על מודולי ה-flow (שורה ~693), כשמוצאים מודול Google Ads, לעדכן גם את `module.metadata.connection` (או הפרופרטי המתאים) ל-connection_id שהתקבל מהבקשה
- הפרמטר `connection_id` כבר קיים ב-interface של הבקשה (שורה 29)

**2. `GoogleAdsTableDialog.tsx` - העברת connection_id בשכפול**
- בקריאת clone_scenario (שורה ~308), להוסיף `connection_id: selectedMakeConnection` לגוף הבקשה

**3. `DynamicTableView.tsx` - העברת connection_id בשכפול חוזר**
- בקריאות clone_scenario מתוך DynamicTableView, להוסיף את ה-connection_id מהגדרות הטבלה (`make_connection_id`)

### פרטים טכניים

בבלופרינט של Make.com, כל מודול נראה כך:
```text
{
  "id": 3,
  "module": "google-ads:runCampaignReport",
  "mapper": { ... },
  "metadata": {
    "connection": { "id": 12345 }  ← זה מה שצריך לעדכן
  }
}
```

הקוד יעדכן את ה-connection בצורה הבאה:
```typescript
if (connection_id && module.module && isGoogleAdsModule(module.module)) {
  if (!module.metadata) module.metadata = {};
  module.metadata.connection = { id: parseInt(connection_id) };
}
```

