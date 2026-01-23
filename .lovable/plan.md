

# תוכנית: תיקון Timeout בסריקת ביטויים

## הבעיה שזיהיתי
בפרויקט יש **67 ביטויים**. הסריקה מנסה לבדוק את כולם בקריאה אחת ל-Edge Function, אבל:
- כל ביטוי לוקח ~2-3 שניות (API call + delay)
- זה אומר ~170 שניות = כ-3 דקות
- **Edge Functions יש timeout של 60 שניות** - אז הסריקה נכשלת באמצע

**ה-API עצמו עובד מעולה!** בדיקה של ביטוי בודד מצאה את הדומיין במיקום 11.

## הפתרון: סריקה בקבוצות קטנות (Batching)
במקום לשלוח את כל 67 הביטויים בבת אחת, הדף יחלק אותם לקבוצות קטנות (למשל 10 ביטויים בכל פעם) וישלח כל קבוצה בנפרד.

## מה ייעשה

### קובץ: `src/pages/RankTrackingProject.tsx`

1. **שינוי `scanMutation`** - במקום לשלוח את כל הביטויים בבת אחת:
   - חלוקה לקבוצות של 10 ביטויים
   - שליחה רצופה של כל קבוצה
   - הצגת התקדמות (כמה קבוצות הושלמו)

2. **הוספת state לתצוגת התקדמות**:
   - `scanProgress` - אחוז ההתקדמות
   - `currentBatch` / `totalBatches` - מספר הקבוצה הנוכחית

3. **עדכון ממשק המשתמש**:
   - הצגת Progress Bar במהלך הסריקה
   - הצגת כמה ביטויים נותרו

### לוגיקת הסריקה החדשה

```
1. קבלת רשימת כל ה-keyword IDs
2. חלוקה לקבוצות של 10
3. לכל קבוצה:
   a. קריאה ל-Edge Function עם הביטויים של הקבוצה
   b. עדכון התקדמות
   c. רענון הנתונים בטבלה
4. הצגת סיכום בסיום
```

## יתרונות הפתרון

| לפני | אחרי |
|------|------|
| קריאה אחת ל-67 ביטויים | 7 קריאות × 10 ביטויים |
| Timeout אחרי 60 שניות | כל קבוצה מסתיימת ב-~25 שניות |
| אין התקדמות | Progress bar + מספרים |
| אם נכשל - מתחילים מחדש | ביטויים שנסרקו נשמרים |

## שינויים טכניים

### הפונקציה החדשה:
```typescript
const scanMutation = useMutation({
  mutationFn: async (keywordIds?: string[]) => {
    const session = await supabase.auth.getSession();
    const idsToScan = keywordIds || keywords?.map(k => k.id) || [];
    
    const BATCH_SIZE = 10;
    const batches = [];
    for (let i = 0; i < idsToScan.length; i += BATCH_SIZE) {
      batches.push(idsToScan.slice(i, i + BATCH_SIZE));
    }
    
    let totalChecked = 0;
    let totalErrors = 0;
    
    for (let i = 0; i < batches.length; i++) {
      setScanProgress({ current: i + 1, total: batches.length });
      
      const response = await fetch(...);
      const data = await response.json();
      
      totalChecked += data.checked_count;
      totalErrors += data.error_count;
      
      // רענון הנתונים אחרי כל קבוצה
      queryClient.invalidateQueries(['rank-tracking-keywords']);
    }
    
    return { totalChecked, totalErrors };
  }
});
```

### הוספת State:
```typescript
const [scanProgress, setScanProgress] = useState<{
  current: number;
  total: number;
} | null>(null);
```

### עדכון ה-UI:
```typescript
<Button disabled={scanMutation.isPending}>
  {scanMutation.isPending ? (
    <>
      <RefreshCw className="animate-spin" />
      סורק... {scanProgress?.current}/{scanProgress?.total}
    </>
  ) : (
    <>
      <Play />
      סרוק הכל
    </>
  )}
</Button>
```

## תוצאה צפויה
- הסריקה תעבוד גם עם 67+ ביטויים
- המשתמש יראה התקדמות בזמן אמת
- הביטויים יתעדכנו תוך כדי הסריקה
- אם יש כשל באמצע - הביטויים שכבר נסרקו יישמרו

