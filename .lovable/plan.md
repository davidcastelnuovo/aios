

## תיקון: הנתונים מ-Google Ads מגיעים ריקים/שגויים

### בעיה שורשית

בדקתי את ה-Blueprint בפועל ב-Make.com וזיהיתי **שתי בעיות קריטיות**:

#### בעיה 1: מיפוי שגוי של שדות בגוף ה-Webhook
ה-HTTP module ב-Make.com שולח את הנתונים עם מיפוי שגוי:
```text
הנוכחי (שגוי):
  "impressions": "{{3.metrics.searchImpressionShare}}"  ← זה לא impressions!
  "cost": "{{3.metrics.cost}}"                          ← בגוגל אדס זה cost_micros

הנדרש (נכון):
  "impressions": "{{3.metrics.impressions}}"
  "cost": "{{3.metrics.costMicros}}"
```

בנוסף, ייתכן שה-references (כמו `{{3.dimensions.date}}`) לא מוחזרים כי המודול הקודם (מס' 3) מחזיר את הנתונים בפורמט שונה ממה שמצופה.

#### בעיה 2: רשומות מגיעות ריקות
הלוגים מראים `1 skipped invalid` - כלומר הרשומות מגיעות בלי `campaign_id` או בלי `date`. זה מאשר שה-references ב-Make.com לא עובדים נכון.

### פתרון מוצע

#### שינוי 1: תיקון ה-Blueprint patching ב-make-api
**קובץ: `supabase/functions/make-api/index.ts`**

כשעושים `patch_scenario_blueprint` או `clone_scenario`, צריך גם **לתקן את ה-jsonStringBodyContent** של ה-HTTP module כך שישתמש ב-references הנכונים של Google Ads Reports:

```text
{
  "records": [{
    "date": "{{3.segments.date}}",
    "campaign_id": "{{3.campaign.id}}",
    "campaign_name": "{{3.campaign.name}}",
    "impressions": "{{3.metrics.impressions}}",
    "clicks": "{{3.metrics.clicks}}",
    "cost_micros": "{{3.metrics.costMicros}}",
    "conversions": "{{3.metrics.conversions}}",
    "ctr": "{{3.metrics.ctr}}",
    "average_cpc": "{{3.metrics.averageCpc}}"
  }]
}
```

בנוסף, צריך להוסיף `segments.date` לרשימת ה-metrics/fields של מודול גוגל אדס (כי בלעדיו אין חלוקה ליומית).

#### שינוי 2: הוספת segments לשאילתת גוגל אדס
במודול ה-Google Ads, צריך לוודא שה-mapper כולל:
- `segments: ["segments.date"]` - כדי לקבל נתונים מחולקים ליום
- או `resourceName: "campaign"` עם `segmentBy: "DATE"`

בלי זה, גוגל אדס יכול להחזיר נתוני סיכום בלי חלוקה ליום.

### קבצים לעריכה
1. `supabase/functions/make-api/index.ts` - תיקון ה-HTTP body template בפעולות `clone_scenario` ו-`patch_scenario_blueprint` עם ה-references הנכונים + הוספת `segments.date` לשדות המבוקשים

### סיכום
הבעיה העיקרית היא שה-Template Scenario ב-Make.com משתמש ב-references שגויים (כמו `searchImpressionShare` במקום `impressions`, ו-`dimensions.date` במקום `segments.date`). התיקון ידרוס את ה-body של ה-HTTP module ב-blueprint עם המיפוי הנכון, ויוסיף את `segments.date` לשדות כדי להבטיח חלוקה יומית.

