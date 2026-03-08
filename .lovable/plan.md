

# תיקון UX: הוספת בחירת טופס ישירות בקטע הראשי

## הבעיה
יש שני כרטיסים נפרדים:
1. **כרטיס ראשי** (`FacebookSettings.tsx`) - בוחרים עמוד, רואים "עמוד פעיל", אבל **אין בחירת טופס**
2. **כרטיס מיפוי** (`FacebookFormMappingSection`) - מופיע למטה מתחת, עם בחירת עמוד **כפולה** + בחירת טופס

המשתמש רואה את הכרטיס הראשי עם "עמוד פעיל" וחושב שזה הכל - לא גולל למטה לכרטיס המיפוי.

## הפתרון
להוסיף לינק/כפתור בולט בכרטיס הראשי שמפנה לקטע המיפוי, ולהוסיף `id` לכרטיס המיפוי כדי לגלול אליו אוטומטית.

### שינויים:

**1. `FacebookSettings.tsx`** - אחרי "עמוד פעיל" (שורה 641), להוסיף כפתור "הגדר טפסים" שגולל למטה לקטע המיפוי:
```tsx
<Button variant="outline" onClick={() => {
  document.getElementById('form-mapping-section')?.scrollIntoView({ behavior: 'smooth' });
}} className="gap-2 w-full">
  <ListTree className="h-4 w-4" />
  הגדר מיפוי טפסים
</Button>
```

**2. `FacebookFormMappingSection.tsx`** - להוסיף `id="form-mapping-section"` ל-Card הראשי (שורה 418) כדי שהגלילה תעבוד.

| קובץ | שינוי |
|-------|-------|
| `src/pages/FacebookSettings.tsx` | הוספת כפתור "הגדר מיפוי טפסים" אחרי "עמוד פעיל" |
| `src/components/forms/FacebookFormMappingSection.tsx` | הוספת `id` לקטע המיפוי |

