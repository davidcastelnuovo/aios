
# תוכנית לתיקון עדכוני לידים שלא מתעדכנים בזמן אמת

## הבעיה שזוהתה

רחלי מדווחת שכאשר היא מעדכנת ליד, היא צריכה לרענן את העמוד כדי לראות את העדכונים. הסיבה היא **אי-התאמה במפתחות ה-cache** בין השאילתות לבין ה-invalidation.

### הבעיה הטכנית

דף הלידים (`Leads.tsx`) משתמש בשלושה query keys ספציפיים:
- `["leads-kanban", ...]` - לתצוגת קנבן
- `["leads-table", ...]` - לתצוגת טבלה  
- `["leads-count", ...]` - לספירת לידים

אבל שני קומפוננטים מרכזיים מבטלים cache עם מפתח גנרי שלא מתאים:
- **`EditLeadDialog.tsx`** - מבטל `["leads"]` בלבד (לא תואם!)
- **`FollowUpDatePicker.tsx`** - מבטל `["leads"]` ו-`["leads-count"]` (חלקי)
- **`ImportLeadsWithMapping.tsx`** - מבטל `["leads"]` (לא תואם)

כתוצאה מכך, כשמשתמש עורך ליד דרך הדיאלוג או משנה תאריך לחזרה, ה-cache לא מתבטל כראוי והנתונים הישנים נשארים בתצוגה.

---

## הפתרון

### שלב 1: תיקון `EditLeadDialog.tsx`
עדכון ה-`onSuccess` callback של ה-mutation לבטל את כל ה-query keys הרלוונטיים:

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["leads-kanban"] });
  queryClient.invalidateQueries({ queryKey: ["leads-table"] });
  queryClient.invalidateQueries({ queryKey: ["leads-count"] });
  toast({
    title: "ליד עודכן בהצלחה",
  });
  setOpen(false);
},
```

### שלב 2: תיקון `FollowUpDatePicker.tsx`
עדכון ה-`onSuccess` callback לבטל את כל ה-query keys:

```typescript
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ["leads-kanban"] });
  queryClient.invalidateQueries({ queryKey: ["leads-table"] });
  queryClient.invalidateQueries({ queryKey: ["leads-count"] });
  toast({
    title: selectedDate ? "תאריך לחזרה נשמר" : "תאריך לחזרה נמחק",
  });
  setDialogOpen(false);
  onSuccess?.();
},
```

### שלב 3: תיקון `ImportLeadsWithMapping.tsx`
עדכון ה-cache invalidation אחרי ייבוא לידים:

```typescript
queryClient.invalidateQueries({ queryKey: ["leads-kanban"] });
queryClient.invalidateQueries({ queryKey: ["leads-table"] });
queryClient.invalidateQueries({ queryKey: ["leads-count"] });
```

---

## קבצים שיעודכנו
1. `src/components/forms/EditLeadDialog.tsx` - שורה 294
2. `src/components/leads/FollowUpDatePicker.tsx` - שורות 61-62  
3. `src/components/forms/ImportLeadsWithMapping.tsx` - שורה 1070

---

## תוצאה צפויה
לאחר התיקון, כל עדכון לליד (עריכה, שינוי תאריך לחזרה, או ייבוא) יתעדכן מיידית בתצוגה ללא צורך ברענון ידני של העמוד.
