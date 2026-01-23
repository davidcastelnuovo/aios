
# תוכנית: המרת אינטגרציית Rank Tracking מ-SerpAPI ל-DataForSEO

## סיכום
נמיר את מערכת מעקב הדירוגים לעבוד עם DataForSEO במקום SerpAPI. השינוי העיקרי הוא בשיטת האימות (Base64 של email:password במקום API key בודד) ובמבנה ה-API.

## יתרונות המעבר
| קריטריון | SerpAPI | DataForSEO |
|----------|---------|------------|
| **עלות ל-1,500 ביטויים/שבוע** | $75/חודש | ~$9/חודש |
| **שיטת תשלום** | מנוי חודשי קבוע | Pay-as-you-go |
| **עלות לחיפוש** | ~$0.01 | ~$0.0015 |

## שלבים טכניים

### שלב 1: עדכון Edge Function לאימות (`serpapi-auth`)
**קובץ**: `supabase/functions/serpapi-auth/index.ts`

שינויים נדרשים:
- שינוי `integration_type` מ-`serpapi` ל-`dataforseo`
- שינוי הטיפול ב-credentials - במקום `api_key` בודד, נשמור `email` ו-`password`
- שינוי כתובת ה-API לבדיקת חיבור: `https://api.dataforseo.com/v3/appendix/user_data`
- עדכון מבנה ה-config הנשמר ב-tenant_integrations

**לוגיקת אימות חדשה:**
```text
┌─────────────────────────────────────────┐
│  1. קבלת email + password מהמשתמש       │
│  2. יצירת Base64 token                  │
│  3. בדיקה מול DataForSEO API           │
│  4. שמירת פרטי החשבון (balance, limits) │
└─────────────────────────────────────────┘
```

### שלב 2: עדכון Edge Function לחיפוש (`serpapi-search`)
**קובץ**: `supabase/functions/serpapi-search/index.ts`

שינויים נדרשים:
- שינוי כתובת ה-API: `https://api.dataforseo.com/v3/serp/google/organic/live/advanced`
- שימוש ב-POST request במקום GET
- שליחת Authorization header עם Base64 token
- עדכון פרסור התוצאות לפורמט של DataForSEO

**מיפוי פרמטרים:**
| SerpAPI | DataForSEO |
|---------|------------|
| `q` (query param) | `keyword` (POST body) |
| `gl=il` | `location_code=2376` (Israel) |
| `hl=he` | `language_code=he` |
| `num=100` | `depth=100` |
| `device=desktop` | `device=desktop` |

**מיפוי מדינות/שפות:**
```text
il (ישראל) → location_code: 2376
us (ארה"ב)  → location_code: 2840
uk (בריטניה) → location_code: 2826
```

### שלב 3: עדכון דף ההגדרות (`SerpApiSettings.tsx`)
**קובץ**: `src/pages/SerpApiSettings.tsx`

שינויים נדרשים:
- שינוי ממודל input יחיד (API Key) לשני שדות (Email + Password)
- עדכון הטקסטים והמותג ל-DataForSEO
- הצגת יתרה (Balance) במקום חיפושים נותרים
- עדכון קישור לדשבורד: `https://app.dataforseo.com/api-access`

### שלב 4: עדכון דף Integrations
**קובץ**: `src/pages/Integrations.tsx`

שינויים נדרשים:
- עדכון שם האינטגרציה ל-DataForSEO
- עדכון הטקסטים והתיאורים

### שלב 5: עדכוני קוד נוספים
עדכון הקריאות ב:
- `src/pages/RankTracking.tsx` - עדכון שם האינטגרציה בהודעות
- `src/pages/RankTrackingProject.tsx` - ללא שינוי (משתמש באותם endpoints)

## מבנה Request/Response של DataForSEO

**Request (POST):**
```json
[{
  "keyword": "מילת חיפוש",
  "location_code": 2376,
  "language_code": "he",
  "device": "desktop",
  "depth": 100
}]
```

**Response Structure:**
```text
response.tasks[0].result[0].items[]
  ├── type: "organic" / "featured_snippet" / etc.
  ├── rank_group: 1 (מיקום)
  ├── url: "https://..."
  └── domain: "example.com"
```

## סיכום קבצים לעדכון

| קובץ | סוג שינוי |
|------|-----------|
| `supabase/functions/serpapi-auth/index.ts` | עדכון מלא - authentication |
| `supabase/functions/serpapi-search/index.ts` | עדכון מלא - search logic |
| `src/pages/SerpApiSettings.tsx` | עדכון UI לשני שדות |
| `src/pages/Integrations.tsx` | עדכון טקסטים |
| `src/pages/RankTracking.tsx` | עדכון טקסטים |

## הערות
- **אין צורך בשינויי Database** - אותו מבנה `tenant_integrations` עם config שונה
- **Backwards compatible** - הקוד הישן לא ישפיע כי נשנה את `integration_type`
- לאחר האישור, אעדכן את כל הקבצים ואפרוס את ה-Edge Functions
