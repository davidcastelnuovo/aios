

## תיקון SharedTable - הפרדה דינמית בין קמפייני איקומרס ולידים

### הבעיה
ב-`SharedTable.tsx` הלוגיקה משתמשת ב-`getCampaignType` שמחזיר "leads" עבור `facebook_insights` באופן קשיח. בפועל, ב-`DynamicTableView.tsx` יש לוגיקה דינמית שמפרידה בין קמפיינים לפי הנתונים בפועל (purchases, add_to_cart, campaign_type).

### הפתרון
**קובץ: `src/pages/SharedTable.tsx`**

החלפת לוגיקת ה-campaign summary הנוכחית (שורות 166-188) ואת טבלת הקמפיינים (שורות 365-453) באותה לוגיקה מ-DynamicTableView:

1. **שינוי `campaignSummary`** - במקום לסנן לפי `isEcommerce` קבוע, לאגד קמפיינים ולסווג כל אחד דינמית לפי:
   - `campaign_type === 'ecommerce'` בנתונים
   - `purchases > 0` או `purchase_value > 0` או `add_to_cart > 0`

2. **פיצול לשתי טבלאות** - בדיוק כמו ב-DynamicTableView:
   - **טבלת איקומרס**: קמפיין, חשיפות, קליקים, הוצאה, הוספות לעגלה, רכישות, ערך רכישות, ROAS
   - **טבלת לידים**: קמפיין, חשיפות, קליקים, הוצאה, לידים, עלות לליד
   - כל טבלה מופיעה רק אם יש קמפיינים מהסוג שלה
   - שורת סה"כ ירוקה בתחתית כל טבלה

3. **עדכון KPI Cards** - להציג את הסיכום הנכון על בסיס הנתונים בפועל (אם יש גם ecommerce וגם leads, להציג שניהם)

### פרטים טכניים
- הסרת `getCampaignType` ו-`isEcommerce` הסטטיים
- שימוש באותה לוגיקת סיווג כמו DynamicTableView שורות 1950-2004
- העתקת מבנה הטבלאות עם אותם עמודות, צבעים (orange לעגלה, green לרכישות, blue ל-ROAS)
- שורת סה"כ עם `bg-primary/10 font-bold`

