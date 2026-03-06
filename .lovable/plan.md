

## שינוי תצוגת "תאריך לחזרה" עם איחור + שינוי פילטר לכלול תאריכים שעברו

### הבעיה
1. כשתאריך לחזרה עבר — הוא לא מופיע בפילטר "לחזרה היום"
2. אין אינדיקציה ויזואלית לאיחור (כמה ימים עברו)
3. לידים באיחור לא מוצגים ראשונים

### הפתרון

**1. עדכון RPC `get_leads_by_stages` (מיגרציה חדשה)**
- שינוי הפילטר מ-`follow_up_date = CURRENT_DATE` ל-`follow_up_date <= CURRENT_DATE`
- כך גם לידים שהתאריך שלהם עבר יופיעו בפילטר "לחזרה היום"
- מיון: לידים עם תאריך לחזרה ישן יותר יופיעו ראשונים (ORDER BY follow_up_date ASC)

**2. עדכון שאילתת Table View (`src/pages/Leads.tsx`)**
- שורות 830-832: שינוי `query.eq("follow_up_date", today)` ל-`query.lte("follow_up_date", today)`
- שורות 1144-1146: אותו שינוי בשאילתת הטבלה

**3. עדכון `FollowUpDatePicker.tsx` — תצוגת איחור**
- כשהתאריך עבר: להציג את התאריך של היום (`dd/MM`) + תגית אדומה "איחור X ימים"
- חישוב: `differenceInDays(today, followUpDate)` מ-date-fns
- צבע אדום לאייקון ולטקסט כשיש איחור
- כשהתאריך = היום: להשאיר ירוק כמו עכשיו

### קבצים לעריכה
- **מיגרציית SQL** — עדכון RPC `get_leads_by_stages`
- **`src/pages/Leads.tsx`** — שינוי `.eq` ל-`.lte` בפילטר follow_up_today
- **`src/components/leads/FollowUpDatePicker.tsx`** — הוספת תצוגת איחור עם חישוב ימים וצבע אדום

