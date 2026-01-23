

# תוכנית: דילוג על ביטויים שכבר נסרקו היום

## הבעיה
כרגע הסריקה עוברת על **כל** הביטויים בפרויקט, גם אלו שכבר נסרקו היום. זה מבזבז:
- קריאות API יקרות
- זמן סריקה מיותר
- מאריך את כל התהליך

## המצב הנוכחי בפרויקט
| סה"כ ביטויים | נסרקו היום | לא נסרקו |
|---------------|------------|----------|
| 67 | 32 | 35 |

## הפתרון
לפני שליחת הביטויים לסריקה, נסנן החוצה את אלו שכבר נסרקו היום.

## מה ייעשה

### קובץ: `src/pages/RankTrackingProject.tsx`

#### 1. פונקציית עזר לבדיקה אם נסרק היום
```typescript
const isScannedToday = (keyword: KeywordRecord): boolean => {
  if (!keyword.last_checked_at) return false;
  const lastChecked = new Date(keyword.last_checked_at);
  const today = new Date();
  return lastChecked.toDateString() === today.toDateString();
};
```

#### 2. עדכון `scanMutation`
בתחילת הפונקציה, לפני חלוקה ל-batches:

```typescript
mutationFn: async (keywordIds?: string[]) => {
  // ...authentication check...

  // Get IDs to scan
  let idsToScan = keywordIds || keywords?.map(k => k.id) || [];
  
  // If scanning all, filter out keywords already scanned today
  if (!keywordIds) {
    const notScannedToday = keywords?.filter(k => !isScannedToday(k)) || [];
    idsToScan = notScannedToday.map(k => k.id);
    
    // Show message if some were skipped
    const skippedCount = (keywords?.length || 0) - idsToScan.length;
    if (skippedCount > 0) {
      toast.info(`דילוג על ${skippedCount} ביטויים שכבר נסרקו היום`);
    }
  }
  
  if (idsToScan.length === 0) {
    throw new Error("כל הביטויים כבר נסרקו היום");
  }
  
  // Continue with batching...
}
```

#### 3. עדכון הודעת ההצלחה
```typescript
onSuccess: (data) => {
  setScanProgress(null);
  const skippedMsg = data.skipped > 0 ? ` (דולגו ${data.skipped})` : '';
  const message = data.totalErrors > 0
    ? `סריקה הושלמה! נבדקו ${data.totalChecked} ביטויים (${data.totalErrors} שגיאות)${skippedMsg}`
    : `סריקה הושלמה! נבדקו ${data.totalChecked} ביטויים${skippedMsg}`;
  toast.success(message);
}
```

## התנהגות צפויה

| פעולה | לפני | אחרי |
|-------|------|------|
| לחיצה על "סרוק הכל" | סורק את כל 67 | סורק רק 35 שלא נסרקו |
| בחירת ביטוי ספציפי וסריקה | סורק | סורק (ללא שינוי) |
| כל הביטויים נסרקו היום | סורק שוב | מציג הודעה "כל הביטויים כבר נסרקו היום" |

## הערה
הלוגיקה תחול רק על "סרוק הכל". אם המשתמש בוחר ביטוי ספציפי לסריקה, הוא יוכל לסרוק אותו שוב גם אם נסרק היום.

