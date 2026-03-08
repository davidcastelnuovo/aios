

# תיקון מודול הגדרת מיקום חתימה

## בעיות שזוהו
1. **חלון קטן מדי** — הגדרת מיקום החתימה נפתחת בתוך `Dialog` עם `max-w-3xl`, שזה צפוף למסמך
2. **PDF לא ניתן ללחיצה** — ה-iframe של PDF תופס את אירועי העכבר, אז אי אפשר ללחוץ/לגרור שדות חתימה מעליו

## הפתרון

### 1. עמוד מלא להגדרת מיקום (במקום Dialog)
- כשלוחצים "הגדר מיקום חתימות", במקום לעבור ל-placement בתוך הדיאלוג, נסגור את הדיאלוג ונפתח **מצב מסך מלא** (full-screen overlay) עם ה-`SignatureFieldPlacer`
- כך המסמך מוצג בגודל מלא ויש מספיק מקום לגרור שדות

### 2. תיקון תצוגת PDF — שכבת overlay שקופה
- ב-`SignatureFieldPlacer`, מעל ה-iframe של PDF נוסיף `div` שקוף (`pointer-events: all`) שתופס את הלחיצות
- ה-iframe יהיה למטה לתצוגה בלבד, והשכבה העליונה תקלוט את האירועים

## קבצים לשינוי

| קובץ | שינוי |
|-------|-------|
| `src/pages/Signatures.tsx` | החלפת placement בדיאלוג → full-screen overlay |
| `src/components/signatures/SignatureFieldPlacer.tsx` | הוספת שכבת overlay מעל iframe, הגדלת minHeight |

## שינויים טכניים

**Signatures.tsx:**
- הוספת state `showFullScreenPlacement` 
- כשלוחצים "הגדר מיקום חתימות" → סוגר Dialog, פותח overlay מסך מלא עם `fixed inset-0 z-50 bg-background`
- ב-overlay: הכותרת + SignatureFieldPlacer + כפתורי "חזור" ו"צור מסמך"

**SignatureFieldPlacer.tsx:**
- עבור PDF/iframe: הוספת `div` שקוף עם `absolute inset-0` מעל ה-iframe שתופס את אירועי העכבר
- הגדלת `minHeight` ל-`80vh` במצב מסך מלא
- הוספת prop `fullScreen` אופציונלי שמשנה את גובה התצוגה

