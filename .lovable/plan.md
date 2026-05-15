## Problem
ב-`TaskDetailDialog` הגלילה הפנימית לא עובדת — כשהתוכן ארוך (במיוחד טאב "עדכונים"), הוא נחתך מבלי שמופיע scrollbar בתוך הדיאלוג.

## Root cause
המבנה הנוכחי (`src/components/tasks/TaskDetailDialog.tsx` שורות 362–814):

```
DialogContent  (max-h-[90vh] flex flex-col)
  DialogHeader
  Tabs         (flex-1 min-h-0 overflow-hidden flex flex-col)
    TabsList
    ScrollArea (flex-1 min-h-0 h-full)
      TabsContent (details / team / updates)
  Footer (מחוץ ל-Tabs)
```

שתי בעיות:
1. **`ScrollArea` עוטף את כל ה-`TabsContent`** — Radix Tabs מסתיר את ה-tabs שאינם פעילים עם `hidden`, אבל ה-Viewport של ScrollArea מקבל גובה רק מ-`h-full` שתלוי ב-flex parent. בפועל ה-Viewport של Radix ScrollArea משתמש ב-`display:table` שלא משתף פעולה היטב עם `flex-1 min-h-0` כשהתוכן הוא Radix `TabsContent` (שמתנהג כ-block ריק עד שהוא active).
2. ה-Footer הוא **sibling של `Tabs`** בתוך `DialogContent`, אבל `DialogContent` הוא `grid gap-4` כברירת מחדל (מ-`ui/dialog.tsx`); ה-`flex flex-col` שמוסף ב-className לא תמיד מנצח את ה-`grid` בגלל סדר ה-tw-merge עם המחלקות הארוכות, וכך ה-`flex-1` של `Tabs` לא מקבל גובה צפוי.

## Fix

קובץ יחיד: `src/components/tasks/TaskDetailDialog.tsx`

1. **לחזק את ה-DialogContent** כך שיהיה ודאי flex-column עם גובה מוגבל:
   ```
   <DialogContent dir="rtl" className="max-w-2xl h-[90vh] !grid-cols-1 grid-rows-[auto,1fr,auto] gap-0 p-6">
   ```
   או — פשוט יותר — להישאר ב-grid הדיפולטי ולהפוך את `Tabs` לתא שגדל: להגדיר `DialogContent` עם `h-[85vh] flex flex-col` ולהסיר את ה-`gap-4` ע"י `gap-0` כדי שלא יהיו רווחים שמכווצים.

2. **להעביר את ה-ScrollArea פנימה** — לתת לכל `TabsContent` להיות עצמו ה-scroll container, במקום ScrollArea אחד עוטף:
   ```
   <Tabs ... className="flex-1 min-h-0 flex flex-col">
     <TabsList ... />
     <TabsContent value="details"
       className="flex-1 min-h-0 mt-4 overflow-y-auto pr-2 space-y-4">
       ...
     </TabsContent>
     <TabsContent value="team"   className="flex-1 min-h-0 mt-4 overflow-y-auto pr-2 space-y-4">...</TabsContent>
     <TabsContent value="updates" className="flex-1 min-h-0 mt-4 overflow-y-auto pr-2 space-y-4">...</TabsContent>
   </Tabs>
   ```
   זה מסיר את התלות ב-Radix ScrollArea ב-context הזה (שגורם לבעיות גובה בתוך flex), ומשתמש ב-overflow מקורי של הדפדפן — שעובד היטב ב-RTL ובדיאלוג.

3. **שמירה על ה-Footer** מחוץ ל-Tabs כפי שהוא, כך שיישאר תמיד נראה בתחתית.

## Verification
לאחר השינוי — לפתוח משימה עם הרבה עדכונים בטאב "עדכונים" ולוודא שמופיע scrollbar בתוך הדיאלוג ושכפתורי "מחק / שמור שינויים" נשארים תמיד גלויים בתחתית.
