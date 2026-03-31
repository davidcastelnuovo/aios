

# תיקון שגיאות Build ב-Reports.tsx

## הבעיה
`Object.entries(revenueByStatus)` מחזיר `[string, unknown][]` למרות שה-reduce מוגדר כ-`Record<string, number>`. TypeScript לא מזהה את הטיפוס בפירוק.

## תיקון
בשורה 588, להוסיף casting ל-entries:

```typescript
{(Object.entries(revenueByStatus) as [string, number][])
  .sort(([, a], [, b]) => b - a)
  .map(([status, amount]) => {
```

שינוי של שורה אחת בלבד — הוספת `as [string, number][]` אחרי `Object.entries(revenueByStatus)`.

### קובץ
- `src/pages/Reports.tsx` — שורה 587

