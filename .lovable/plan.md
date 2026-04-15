

# תיקון סופי: כרמן עונה רק בצ'אט עצמי (972507677613)

## שורש הבעיה

יש **שני נתיבים נפרדים** שיוצרים סשנים של כרמן:

1. **`green-api-webhook`** — handler ישיר (שורות 1690-1802) שיוצר סשנים ישירות ו**לא בודק כלל** את `carmen_scope_mode` או `carmen_allowed_phones` מתוך הגדרות האוטומציה
2. **`trigger-automation`** — כן בודק scope דרך `validateFlowTriggerConfig`, אבל הנתיב הראשון "קופץ" לפניו

האוטומציה שלך מוגדרת נכון (`carmen_scope_mode: specific_phone`, `carmen_allowed_phones: [972507677613]`), אבל ה-webhook מתעלם מזה ופותח סשנים בכל צ'אט.

**הוכחה מהדאטה:** הסשן הפעיל עכשיו (740c70db) נוצר עם `automation_id: NULL` — כלומר ה-webhook יצר אותו ישירות, בלי לעבור דרך האוטומציה שמכילה את הגבלות ה-scope.

## התיקון

### פעולה 1: סגירת הסשן הפעיל הלא-חוקי
- UPDATE ב-DB לסגירת הסשן `740c70db` (status='ended')

### פעולה 2: `supabase/functions/green-api-webhook/index.ts`

**הוספת אכיפת scope ב-handler הישיר** (שורות 1697-1707):

אחרי ש-`findCarmenSessionAutomation` מחזיר את האוטומציה עם הקונפיגורציה (שכוללת `carmen_scope_mode` ו-`carmen_allowed_phones`), להוסיף בדיקה:

```text
if carmenAutomation exists:
  config = carmenAutomation.configuration
  scopeMode = config.carmen_scope_mode
  
  if scopeMode === 'specific_phone':
    allowedPhones = config.carmen_allowed_phones || []
    if phoneNumber NOT in allowedPhones:
      → SKIP (don't create session) + log
  
  if scopeMode === 'private_only':
    → already handled (isGroup check exists)
  
  if scopeMode === 'specific_group':
    → SKIP for non-group chats
```

גם **בהמשך סשן קיים** (שורה 1621): להוסיף בדיקה שהסשן שייך לצ'אט מורשה — או לשמור את ה-automation_id בסשן כדי שניתן יהיה לבדוק.

### פעולה 3: שמירת `automation_id` בסשנים חדשים

בשורה 1738-1753, כשנוצר סשן חדש, להוסיף:
```
automation_id: carmenAutomation.id
```

כרגע זה NULL, מה שמונע בדיקת scope על סשנים שנוצרו מה-webhook.

### פעולה 4: Deploy
- Deploy מחדש את `green-api-webhook`

```text
Flow אחרי התיקון:

green-api-webhook handler:
  1. findCarmenSessionAutomation → gets config with scope rules
  2. CHECK SCOPE: specific_phone → only 972507677613 allowed
  3. If phone NOT allowed → SKIP entirely
  4. If phone allowed + trigger keyword + outgoing → create session with automation_id
  
  Active session handler:
  5. findActiveCarmenSession → found
  6. Session has automation_id → can validate scope if needed
  7. Continue session normally
```

