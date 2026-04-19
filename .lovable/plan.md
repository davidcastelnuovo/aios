

## ✅ אישרתי באתר — יש 8 לידים מצפון הודו ולדאק

מהאתר eco-trip.landing-p.org בעמוד `/north-india-ladakh/` (90 הימים האחרונים):
- **8 הגשות** ממקור Google Ads
- כולן מצביעות על `gad_campaignid=23761421473`

## ❌ הבעיה שזיהיתי — **3 באגים** ביישום הקודם

### באג 1: שיוך לפי Campaign ID לא יעבוד **לעולם** במקרה הזה
- בגוגל אדס הקמפיין נקרא `טיול לצפון הודו ולדאק - Pmax` עם **campaign_id = 23756715038**
- באתר ה-`gad_campaignid` של 8 הלידים הוא **23761421473** (זה ה-Asset Group ID של PMax, לא ה-Campaign ID)
- הם **לעולם לא יתאימו** בהשוואת ID ישירה → לכן `verified_leads = 0`

### באג 2: ה-fallback של slug-matching נכשל
- ה-slug באתר: `north-india-ladakh`
- שם הקמפיין: `טיול לצפון הודו ולדאק - Pmax`
- ההשוואה הנוכחית מנסה לנרמל שם עברי מול slug באנגלית — חסר תרגום/מיפוי

### באג 3: כפילות נוצרת + בעיה ב-`fetch-elementor-submissions`
- בלוג של הסנכרון רואים `form_name=[object Object]` — הפונקציה לא מחלצת נכון את שם הטופס מ-Elementor
- (לא קריטי לנושא הנוכחי, אבל פוגם)

## 🛠 התוכנית לתיקון

### 1. הוספת **שיוך לפי Slug של URL** (הפתרון העיקרי)
במקום לסמוך על השם, נתבסס על מה שיש לנו — **ה-URL של ההגשה**:

- בסנכרון Google Ads, נחשב **map חדש** מבוסס URL slug (`north-india-ladakh` → 8 לידים) במקום רק campaign_id.
- ניצור **טבלה ידנית** של מיפוי `slug → campaign_id` שיישמר ברשומה של האתר (`social_media_wordpress_sites.campaign_url_mapping` — עמודה JSON חדשה).
- **אוטומציה ראשונית**: אם slug מופיע בקליקים של גוגל אדס (דרך `final_url`/`destination_url` של ה-ad), נמלא את המיפוי אוטומטית. אם לא, המשתמש משייך ידנית פעם אחת.

### 2. UI חדש: **כפתור "שייך עמודי נחיתה לקמפיינים"** בדף האתר
- בדף `WordPressSettings` יתווסף כפתור שפותח דיאלוג.
- מוצגת רשימה של כל ה-slugs שהתגלו באתר (מתוך ה-submissions) → שדה Select לכל slug עם רשימת הקמפיינים הקיימים בלקוח.
- שמירה מעדכנת `campaign_url_mapping` באתר.

### 3. תיקון לוגיקת ה-Verification ב-`sync-google-ads-data`
- שיוך **ראשי**: לפי `campaign_url_mapping[slug] → campaign_id`
- שיוך **משני** (fallback): לפי `gad_campaignid` ישיר (כשהם כן תואמים)
- שיוך **שלישי** (fallback): לפי slug normalization מול שם הקמפיין
- שמירת `verified_source` עם ה-slug שזוהה (לתצוגה).

### 4. תיקון `fetch-elementor-submissions`
- הוצאת `form_name` נכונה מהאובייקט (כרגע מקבל אובייקט במקום string).

### 5. תיקון התצוגה ב-`DynamicTableView`
- אם `verified_leads > conversions` → תג **כתום** (כבר קיים).
- הוספת **טוטיפ מורחב** שמראה את ה-slug ומספר הלידים בפועל מהאתר.

## פירוט טכני

**שינוי DB:** הוספת עמודה `campaign_url_mapping JSONB` ל-`social_media_wordpress_sites` במבנה:
```json
{ "north-india-ladakh": "23756715038", "antarctica": "23718662347", ... }
```

**קבצים שמשתנים:**
- `supabase/functions/fetch-elementor-submissions/index.ts` — תיקון `form_name`, החזרת `slug` לכל הגשה
- `supabase/functions/sync-google-ads-data/index.ts` — שימוש ב-`campaign_url_mapping` כשיוך ראשי
- `src/pages/WordPressSettings.tsx` — כפתור + דיאלוג מיפוי slugs לקמפיינים
- `src/pages/DynamicTableView.tsx` — טוליטיפ עם פירוט slug

**ללא כפילות חדשה** — נשארים על אותה ארכיטקטורה (פונקציה אחת מושכת לידים, השנייה מאמתת).

