
# תוכנית: הוספת שיוך לידים לאנשי מכירות בתפריט הפעולות המרובות

## סקירה כללית
הפיצ'ר יאפשר למשתמש לבחור מספר לידים בטבלה ולשייך אותם לאנשי מכירות בלחיצה אחת. התכונה תתמוך בשיוך לאיש מכירות אחד או יותר (חלוקה שווה).

## מצב נוכחי
- סרגל הפעולות המרובות (Bulk Actions Toolbar) מכיל כרגע:
  - שינוי שלב במשפך
  - מחיקת לידים
- קיימת כבר שליפה של אנשי מכירות בדף (`salesPeople` query בשורות 1122-1138)
- בסיס הנתונים תומך בקישור ליד לאיש מכירות **אחד בלבד** דרך העמודה `sales_person_id`

## הפתרון המוצע
### אפשרות 1: שיוך לאיש מכירות בודד
- הוספת Select פשוט לבחירת איש מכירות בסרגל הפעולות
- כל הלידים שנבחרו יעודכנו לאותו איש מכירות

### אפשרות 2: שיוך מחולק בין מספר אנשי מכירות (מועדף לפי הבקשה)
- שימוש בדיאלוג עם multi-select לבחירת מספר אנשי מכירות
- חלוקה שווה של הלידים בין אנשי המכירות שנבחרו
- לדוגמה: 50 לידים ← 2 אנשי מכירות ← כל אחד מקבל 25 לידים

---

## פירוט טכני

### שלב 1: הוספת state לדיאלוג שיוך
**קובץ:** `src/pages/Leads.tsx`

ב-`TableWithStickyScroll` component, יש להוסיף:
```typescript
const [assignDialogOpen, setAssignDialogOpen] = useState(false);
const [selectedSalesPeople, setSelectedSalesPeople] = useState<string[]>([]);
```

### שלב 2: הוספת mutation לשיוך מרובה
**קובץ:** `src/pages/Leads.tsx`

```typescript
const bulkAssignSalesPerson = useMutation({
  mutationFn: async ({ leadIds, salesPersonIds }: { leadIds: string[]; salesPersonIds: string[] }) => {
    // חלוקה שווה של הלידים בין אנשי המכירות
    const assignments: { leadId: string; salesPersonId: string }[] = [];
    leadIds.forEach((leadId, index) => {
      const salesPersonIndex = index % salesPersonIds.length;
      assignments.push({ leadId, salesPersonId: salesPersonIds[salesPersonIndex] });
    });
    
    // עדכון כל ליד לאיש המכירות שלו
    const promises = assignments.map(({ leadId, salesPersonId }) => 
      supabase
        .from("leads")
        .update({ sales_person_id: salesPersonId })
        .eq("id", leadId)
    );
    
    const results = await Promise.all(promises);
    const errors = results.filter(r => r.error);
    if (errors.length > 0) throw new Error(`${errors.length} עדכונים נכשלו`);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["leads-kanban"] });
    queryClient.invalidateQueries({ queryKey: ["leads-table"] });
    setSelectedLeads([]);
    setAssignDialogOpen(false);
    setSelectedSalesPeople([]);
    toast({ title: "לידים שויכו בהצלחה" });
  },
  onError: (error: any) => {
    toast({
      title: "שגיאה בשיוך לידים",
      description: error.message,
      variant: "destructive",
    });
  },
});
```

### שלב 3: הוספת כפתור שיוך לסרגל הפעולות
**קובץ:** `src/pages/Leads.tsx`

בסרגל הפעולות המרובות (שורות 2820-2864), יש להוסיף:
```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => setAssignDialogOpen(true)}
  className="h-8 bg-background text-foreground"
>
  <User className="h-4 w-4 mr-1" />
  שייך לאנשי מכירות
</Button>
```

### שלב 4: יצירת דיאלוג שיוך
**קובץ:** `src/pages/Leads.tsx`

יש להוסיף דיאלוג עם multi-select:
```tsx
<Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>שייך {selectedLeads.length} לידים לאנשי מכירות</DialogTitle>
    </DialogHeader>
    
    <div className="space-y-4">
      {/* הסבר על חלוקה */}
      {selectedSalesPeople.length > 1 && (
        <p className="text-sm text-muted-foreground">
          הלידים יחולקו שווה בשווה בין {selectedSalesPeople.length} אנשי המכירות 
          (כ-{Math.ceil(selectedLeads.length / selectedSalesPeople.length)} לידים לכל אחד)
        </p>
      )}
      
      {/* רשימת אנשי מכירות עם checkboxes */}
      <div className="max-h-[300px] overflow-y-auto space-y-2">
        {salesPeople?.map((sp) => (
          <div key={sp.id} className="flex items-center gap-2">
            <Checkbox
              id={sp.id}
              checked={selectedSalesPeople.includes(sp.id)}
              onCheckedChange={(checked) => {
                if (checked) {
                  setSelectedSalesPeople(prev => [...prev, sp.id]);
                } else {
                  setSelectedSalesPeople(prev => prev.filter(id => id !== sp.id));
                }
              }}
            />
            <label htmlFor={sp.id}>{sp.full_name}</label>
          </div>
        ))}
      </div>
    </div>
    
    <DialogFooter>
      <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
        ביטול
      </Button>
      <Button 
        onClick={() => bulkAssignSalesPerson.mutate({ 
          leadIds: selectedLeads, 
          salesPersonIds: selectedSalesPeople 
        })}
        disabled={selectedSalesPeople.length === 0 || bulkAssignSalesPerson.isPending}
      >
        {bulkAssignSalesPerson.isPending ? "משייך..." : "שייך"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### שלב 5: העברת salesPeople לתוך TableWithStickyScroll
**קובץ:** `src/pages/Leads.tsx`

כרגע `salesPeople` נשלף ב-component הראשי `Leads()`. יש להעביר אותו כ-prop ל-`TableWithStickyScroll`:
- להוסיף את salesPeople ל-props של StageTable ו-TableWithStickyScroll
- או לשלוף אותו מחדש בתוך TableWithStickyScroll

---

## סיכום השינויים

| קובץ | שינוי |
|------|-------|
| `src/pages/Leads.tsx` | הוספת state לדיאלוג + mutation לשיוך + UI לכפתור ודיאלוג |

---

## הערות נוספות
- **RLS**: לא נדרשים שינויים ב-RLS - המשתמש כבר יכול לעדכן לידים שהוא רואה
- **אופטימיזציה**: ניתן בעתיד לשפר ל-batch update אחד במקום Promise.all אם יש הרבה לידים
- **Validation**: הדיאלוג לא יאפשר שיוך עד שנבחר לפחות איש מכירות אחד
