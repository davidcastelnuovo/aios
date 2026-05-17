## הוספת טווח תאריכים מותאם אישית לקישור שיתוף

הבעיה: ב-`SharedTable.tsx` יש Select בודד עם presets בלבד (היום / 7 ימים / 30 יום וכו'), בלי אפשרות לבחור תאריכים ידנית – בניגוד למסך הפנימי שבו יש "טווח מותאם אישית..." דרך `DateRangeFilter`.

הטוב: ה-Edge Function `public-table` כבר תומך בפרמטרים `custom_start` ו-`custom_end` (שורות 33, 86–87, 177, 633). לכן צריך רק שינוי UI + העברת הפרמטרים.

### שינויים

**`src/pages/SharedTable.tsx`**
1. הוספת state:
   - `customStart?: Date`, `customEnd?: Date`
   - `isCustomOpen` ל-Popover.
2. שינוי ה-`Select` ל-`DropdownMenu` (כמו ב-`DateRangeFilter`) עם:
   - כל ה-presets הקיימים מ-`DATE_FILTERS`.
   - `DropdownMenuSeparator` ואז `Popover` עם שני `Calendar` (מתאריך / עד תאריך) + כפתורי "החל" / "ביטול".
   - כשבוחרים custom: `setDateFilter('custom')` ושמירת התאריכים.
3. עדכון ה-query:
   - `queryKey` כולל גם `customStart` ו-`customEnd`.
   - אם `dateFilter === 'custom'` ויש שני תאריכים – להוסיף ל-URL: `custom_start=YYYY-MM-DD` ו-`custom_end=YYYY-MM-DD` (פורמט `format(d,'yyyy-MM-dd')`).
4. תווית כפתור הטריגר:
   - אם custom – להציג `dd/MM/yy - dd/MM/yy` (כמו ב-`DateRangeFilter.formatCustomRange`).
   - אחרת – ה-label של ה-preset.

ללא שינויים ב-Edge Function או בלוגיקה עסקית – זה שינוי UI בלבד שמשתמש בתשתית קיימת.