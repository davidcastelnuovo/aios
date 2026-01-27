
# תוכנית: איחוד דיאלוג שיוך אנשי מכירות + תמיכה בריבוי שיוכים

## הבעיה הנוכחית
יש כפילות בלוגיקה של שיוך אנשי מכירות:
1. **דיאלוג בפעולות מרובות** (`Leads.tsx`) - תומך במספר אנשי מכירות (checkboxes) ומשתמש בטבלת `lead_sales_people`
2. **דיאלוג עריכת ליד** (`EditLeadDialog.tsx`) - תומך באיש מכירות יחיד בלבד (select dropdown) ומעדכן רק את `sales_person_id`

צילום המסך שהעלית מציג את השדה "איש מכירות" בדיאלוג העריכה - שכרגע מאפשר בחירה של איש מכירות **אחד בלבד**.

---

## הפתרון המוצע

### עיקרון
החלפת ה-Select הבודד בדיאלוג העריכה ברכיב Multi-Select עם Checkboxes - בדיוק כמו בדיאלוג השיוך המרובה.

```text
┌─────────────────────────────────┐
│       איש מכירות               │
├─────────────────────────────────┤
│  ☑ נחמה                        │
│  ☑ רויטל                       │
│  ☐ יוסי                        │
│  ☐ דני                         │
└─────────────────────────────────┘
```

---

## שינויים נדרשים

### 1. עדכון EditLeadDialog.tsx

**א. הוספת שליפת אנשי מכירות משויכים מטבלת הקישור:**
```typescript
// Fetch current lead's sales people assignments
const { data: leadSalesPeople = [] } = useQuery({
  queryKey: ['lead-sales-people', lead.id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('lead_sales_people')
      .select('sales_person_id')
      .eq('lead_id', lead.id);
    if (error) throw error;
    return data.map(sp => sp.sales_person_id);
  },
  enabled: !!lead.id && open,
});
```

**ב. הוספת state מקומי לניהול הבחירות:**
```typescript
const [selectedSalesPeople, setSelectedSalesPeople] = useState<string[]>([]);

// Sync with fetched data when dialog opens
useEffect(() => {
  if (leadSalesPeople.length > 0) {
    setSelectedSalesPeople(leadSalesPeople);
  } else if (lead.sales_person_id) {
    // Fallback to legacy field
    setSelectedSalesPeople([lead.sales_person_id]);
  }
}, [leadSalesPeople, lead.sales_person_id]);
```

**ג. החלפת ה-Select ב-Checkbox List:**
שינוי הקוד בשורות 542-565 מ-Select בודד לרשימת Checkboxes:
```tsx
<FormItem>
  <FormLabel>אנשי מכירות</FormLabel>
  <div className="border rounded-lg p-3 max-h-[150px] overflow-y-auto space-y-2">
    {salesPeople?.map((person) => (
      <div key={person.id} className="flex items-center gap-2">
        <Checkbox
          id={`sp-edit-${person.id}`}
          checked={selectedSalesPeople.includes(person.id)}
          onCheckedChange={(checked) => {
            if (checked) {
              setSelectedSalesPeople(prev => [...prev, person.id]);
            } else {
              setSelectedSalesPeople(prev => 
                prev.filter(id => id !== person.id)
              );
            }
          }}
        />
        <label htmlFor={`sp-edit-${person.id}`}>
          {person.full_name}
        </label>
      </div>
    ))}
  </div>
</FormItem>
```

**ד. עדכון ה-updateMutation לטפל בטבלת הקישור:**
```typescript
// In updateMutation, after updating the lead:

// 1. Delete existing assignments for this lead
await supabase
  .from('lead_sales_people')
  .delete()
  .eq('lead_id', lead.id);

// 2. Insert new assignments
if (selectedSalesPeople.length > 0) {
  const assignments = selectedSalesPeople.map(spId => ({
    lead_id: lead.id,
    sales_person_id: spId,
    tenant_id: lead.tenant_id,
  }));
  
  await supabase
    .from('lead_sales_people')
    .insert(assignments);
}

// 3. Update legacy field for backwards compatibility
submitData.sales_person_id = selectedSalesPeople[0] || null;
```

---

### 2. אופציונלי: יצירת רכיב SalesPersonMultiSelect משותף

ליצירת רכיב אחד לשימוש חוזר גם ב-Leads.tsx וגם ב-EditLeadDialog.tsx:

```typescript
// src/components/leads/SalesPersonMultiSelect.tsx
interface Props {
  salesPeople: { id: string; full_name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}
```

---

## סיכום הקבצים לעדכון

| קובץ | שינוי |
|------|-------|
| `src/components/forms/EditLeadDialog.tsx` | החלפת Select ב-Multi-Checkbox + עדכון mutation |

---

## תוצאה צפויה
- בדיאלוג עריכת ליד יופיע רשימת checkboxes במקום dropdown
- ניתן יהיה לסמן מספר אנשי מכירות לליד אחד
- הנתונים יישמרו בטבלת `lead_sales_people` (many-to-many)
- תאימות לאחור: העמודה `sales_person_id` בטבלת `leads` תמשיך להתעדכן עם איש המכירות הראשון
