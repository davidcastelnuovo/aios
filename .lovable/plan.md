
# הוספת כפתור "בחר את כל הלידים" לסרגל הפעולות

## הבעיה
כפתור "בחר את כל הלידים" לא מופיע כי הבדיקה `totalLeadsCount > stageLeads.length` תמיד נכשלת - ה-`totalLeadsCount` שמועבר ל-`TableWithStickyScroll` הוא מספר הלידים בשלב הספציפי בלבד, שתמיד שווה למספר הלידים המוצגים.

## הפתרון

### קובץ: `src/pages/Leads.tsx`

1. להעביר את `totalLeadsCount` הכללי (סך כל הלידים בטננט) ל-`StageTable` ומשם ל-`TableWithStickyScroll`, כ-prop נפרד בשם `overallTotalCount`
2. לשנות את התנאי `showSelectAllButton` להשתמש ב-`overallTotalCount` במקום ב-`totalLeadsCount` של השלב
3. התנאי החדש: אם כל הלידים בשלב נבחרו ויש עוד לידים בסך הכל שלא נבחרו, הצג את הכפתור

### שינויים ספציפיים:

**StageTable** - הוספת prop `overallTotalCount` והעברתו ל-`TableWithStickyScroll`

**TableWithStickyScroll** - הוספת prop `overallTotalCount` ושינוי התנאי:
```
showSelectAllButton = isAllPageSelected && !isAllLeadsSelected && overallTotalCount && overallTotalCount > stageLeads.length
```

**קריאה ל-StageTable** (שורה 2766) - הוספת `overallTotalCount={totalLeadsCount}`

### תוצאה צפויה
כשכל הלידים בשלב מסוים נבחרים, יופיע כפתור "בחר את כל X הלידים" שיטען את כל ה-IDs מכל השלבים ויסמן אותם
