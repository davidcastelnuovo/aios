

## תיקון: הצגת אנשי קשר נוספים ודרופדאון משתמשי מערכת בזימון פגישה

### הבעיה

שתי בעיות בטאב הפגישה של לקוח "רווה קולינריה נוזלית":

1. **"גורמי" לא מופיע ברשימת הזימון** — למרות שקיים בטבלת `client_contacts`, ייתכן שה-query לא מחזיר תוצאות בזמן (race condition) או שהנתונים לא נטענים כי ה-`useMemo` לא מתעדכן כשה-data מגיע. בנוסף, האימייל של גורמי (`gurami@rave-cc.com`) שמור בשדה `phone` במקום בשדה `email` — צריך לתקן את הנתון בDB.

2. **דרופדאון משתמשי מערכת לא מוצג** — הסקשן "הזמן משתמשים מהמערכת" לא נראה. ייתכן שה-query ל-`profiles` מחזיר מערך ריק מסיבת RLS, או שהתנאי `teamMembers && teamMembers.length > 0` לא מתקיים.

### תוכנית תיקון

**שלב 1: תיקון נתון בDB**
- העברת `gurami@rave-cc.com` מהשדה `phone` לשדה `email` של איש הקשר "גורמי" דרך migration

**שלב 2: שיפור שליפת משתמשי מערכת**
- שינוי ה-query של `teamMembers` כך שיסנן לפי `tenant_id` דרך `tenant_users` (במקום לשלוף את כל ה-profiles)
- זה יבטיח שרק משתמשים מאותו ארגון יוצגו, ויתאים ל-RLS

```typescript
// שינוי מ:
.from("profiles").select("id, full_name, email").not("email", "is", null)

// ל:
.from("tenant_users").select("user_id, profiles!inner(id, full_name, email)")
.eq("tenant_id", tenantId)
.not("profiles.email", "is", null)
```

**שלב 3: הוספת fallback UI**
- הצגת הודעה "לא נמצאו משתמשים" אם `teamMembers` ריק, במקום הסתרה מלאה — כדי לעזור בדיבוג

**שלב 4: וידוא תלויות useMemo**
- ווידוא ש-`allContactEmails` מתעדכן נכון כש-`clientContacts` נטען

