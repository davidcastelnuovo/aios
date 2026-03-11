

# תיקון: משתני fb_ ריקים בטסט עם לידים שנמשכו

## הבעיה

כשמריצים טסט על ליד שנמשך מהדאטאבייס, ה-payload שנשלח ל-`trigger-automation` מכיל רק שדות DB רגילים (company_name, phone, notes...) אבל **אין שדות `fb_*`**. לכן `{{fb_שם_מלא}}`, `{{fb_מספר_טלפון}}` וכו' נשארים כטקסט גולמי.

זה קורה כי:
1. הסנכרון שומר את הליד בדאטאבייס בלי שדות fb_ (הם רק ב-notes כטקסט)
2. הפרונטאנד שולח רק את מה שיש בדאטאבייס

## הפתרון

בפונקציה `trigger-automation`, לפני הרצת שלבי הפלוו (שורות ~400-420), כש:
- `automation.is_flow === true`
- `payloadData.test === true`  
- `payloadData.lead_id` קיים
- אין שדות `fb_*` ב-data
- ה-notes מכיל `leadgen_id`

→ לחלץ את ה-`leadgen_id` מה-notes, למצוא את ה-trigger step עם `facebook_form_id`, להשתמש ב-`facebook_integration_id` כדי לקבל token, לקרוא מ-Facebook Graph API (`/{leadgen_id}?access_token=...`), ולהעשיר את `payloadData` עם שדות `fb_*`.

## שינויים

### קובץ: `supabase/functions/trigger-automation/index.ts`
בין שורה ~414 (אחרי שליפת ה-flow steps) לבין שורה ~420 (לפני הלולאה על ה-steps), להוסיף:

1. בדיקה: `payloadData.test && !Object.keys(payloadData).some(k => k.startsWith('fb_'))`
2. חילוץ `leadgen_id` מ-`payloadData.notes` (regex: `leadgen_id: (\d+)`)
3. מציאת trigger step מתוך flowSteps
4. שליפת token מ-`tenant_integrations` לפי `facebook_integration_id` (כולל shared)
5. קריאה ל-Facebook: `GET https://graph.facebook.com/v19.0/{leadgen_id}?access_token={token}`
6. פירוק `field_data` → `fb_{name}` ושילוב ב-`payloadData`

כך גם טסט על ליד ישן יקבל את כל שדות הפייסבוק המקוריים.

