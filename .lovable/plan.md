

# תוכנית: הרחבת טריגר "ליד חדש נוצר" עם בחירת מקור

## סקירה
כשמשתמש בוחר "ליד נוצר" כטריגר בפלוו, ייפתח דיאלוג משני שמאפשר לבחור את מקור הליד:
1. **ליד חדש בארגון** - כל ליד שנוצר ידנית או מכל מקור
2. **ליד מטופס ליד** - ליד שהגיע מטופס פייסבוק ספציפי, עם אפשרות לבחור טופס מתוך אינטגרציית Facebook Lead Ads

## שינויים

### StepConfigPanel.tsx
- כשנבחר `lead_created` כטריגר, מציגים Select נוסף עם שתי אפשרויות:
  - `any` - ליד חדש בארגון (כל מקור)
  - `facebook_form` - ליד מטופס ליד
- כשנבחר `facebook_form`, מציגים:
  1. Select לבחירת אינטגרציית Facebook (מתוך `tenant_integrations` של המשתמש)
  2. Select לבחירת טופס ספציפי (נטען מ-Edge Function `get-facebook-forms`)
- הערכים נשמרים ב-`configuration`: `{ lead_source: "any" | "facebook_form", facebook_form_id: "...", facebook_page_id: "..." }`

### שימוש בקומפוננטות קיימות
- נשתמש בלוגיקה דומה ל-`FacebookFormMappingSection` לטעינת דפים וטפסים
- שאילתות ל-`tenant_integrations` לקבלת רשימת חיבורי Facebook זמינים

### ללא שינויי DB
הכל נשמר ב-`configuration` (jsonb) של הצעד הקיים.

