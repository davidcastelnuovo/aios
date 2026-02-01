
# תוכנית שיפור ביצועים: עדכון ליד מהיר יותר

## הבעיות שזוהו

### 1. פעולות סדרתיות איטיות
ה-mutation מבצע 4-5 פעולות ברצף, וכל אחת חוסמת את הבאה:

```
עדכון lead → מחיקת sales_people → הכנסת sales_people → trigger automation
     ↓             ↓                    ↓                    ↓
   ~100ms        ~100ms              ~100ms               ~200ms
```

**סה"כ: ~500ms-800ms של המתנה**

### 2. אין Optimistic Update
המשתמש מחכה עד שכל הפעולות יסתיימו בשרת לפני שרואה שינוי ב-UI.

### 3. invalidateQueries לכל ה-queries
ברגע שהמוטציה מסתיימת, מתבצעות 4 קריאות refetch.

## הפתרון

### חלק 1: Optimistic Update
לעדכן את ה-UI מיידית עם הנתונים החדשים, לפני שהשרת מאשר:

```typescript
updateMutation = useMutation({
  mutationFn: ...,
  onMutate: async (newValues) => {
    // 1. בטל קריאות שרצות
    await queryClient.cancelQueries({ queryKey: ["leads-kanban"] });
    
    // 2. שמור snapshot לפני השינוי
    const previousData = queryClient.getQueryData(["leads-kanban"]);
    
    // 3. עדכן את ה-cache מיידית
    queryClient.setQueryData(["leads-kanban"], (old) => {
      // עדכן את הליד ב-cache
      return updateLeadInCache(old, lead.id, newValues);
    });
    
    // 4. סגור את הדיאלוג מיד
    setOpen(false);
    toast({ title: "מעדכן ליד..." });
    
    return { previousData };
  },
  onError: (err, newValues, context) => {
    // אם נכשל - החזר לנתונים הקודמים
    queryClient.setQueryData(["leads-kanban"], context.previousData);
    toast({ title: "שגיאה בעדכון", variant: "destructive" });
  },
  onSettled: () => {
    // רק אחרי הכל - רענן מהשרת
    queryClient.invalidateQueries({ queryKey: ["leads-kanban"] });
  }
});
```

### חלק 2: פעולות מקבילות
להריץ את עדכון ה-lead ואת עדכון ה-sales_people במקביל:

```typescript
// במקום פעולות סדרתיות:
const [leadResult, salesResult] = await Promise.all([
  // עדכון הליד
  supabase.from("leads").update(submitData).eq("id", lead.id).select().single(),
  
  // עדכון sales_people (delete + insert בפעולה אחת)
  updateSalesPeopleAssignments(lead.id, selectedSalesPeople, lead.tenant_id)
]);
```

### חלק 3: Automation ברקע
להריץ את ה-automation בלי לחכות לתוצאה:

```typescript
// לא לחכות לתשובה - לתת לזה לרוץ ברקע
if (lead.status !== data.status) {
  supabase.functions.invoke('trigger-automation', { body: {...} })
    .catch(console.error); // לא await!
}
```

## פרטים טכניים

### קובץ לעדכון
`src/components/forms/EditLeadDialog.tsx`

### שינויים

**1. הוספת onMutate ל-optimistic update (שורות 257-280)**:
- לשמור את הנתונים הנוכחיים
- לעדכן את ה-cache מיידית
- לסגור את הדיאלוג

**2. שינוי mutationFn לפעולות מקבילות**:
- `Promise.all` לעדכון lead + sales_people
- Automation בלי await

**3. שינוי onSuccess**:
- להסיר את סגירת הדיאלוג (כבר נסגר ב-onMutate)
- להציג toast מתאים

**4. הוספת onError לשחזור**:
- להחזיר את הנתונים הקודמים ל-cache
- להציג הודעת שגיאה

## השפעה צפויה

| לפני | אחרי |
|------|------|
| המתנה של 500-800ms | תגובה מיידית |
| הדיאלוג נסגר רק בסוף | הדיאלוג נסגר מיד |
| "תקוע" בזמן עדכון | UI מתעדכן אופטימיסטית |

## סיכום הפעולות

1. **Optimistic Update** - סגירת הדיאלוג ועדכון UI מיידי
2. **Promise.all** - הרצת lead update + sales_people במקביל
3. **Fire & forget** - automation בלי await
4. **Toast מעודכן** - "מעדכן ליד..." במקום המתנה שקטה
