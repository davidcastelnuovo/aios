

# תיקון RTL בתוצאות אוטומציה

## הבעיה
הטקסט בתוצאות הסוכן (agent output) ובפאנל ההיסטוריה מוצג LTR במקום RTL, כך שהעברית לא מיושרת נכון.

## שינויים

### 1. `src/components/automations/TestFlowWithLeadDialog.tsx`
- הוספת `dir="rtl"` ל-`DialogContent`
- הוספת `text-right` לאזורי התוצאות והפלט של הסוכן

### 2. `src/components/automations/ExecutionHistoryPanel.tsx`
- הוספת `dir="rtl"` ו-`text-right` לאזורי תוצאת הסוכן, הפקודה, והשגיאות
- וידוא שכל הטקסטים העבריים מיושרים ימינה

## קבצים
1. `src/components/automations/TestFlowWithLeadDialog.tsx`
2. `src/components/automations/ExecutionHistoryPanel.tsx`

