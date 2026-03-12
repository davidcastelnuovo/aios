

# באג: אוטומציית "משימה לדוד מהווטסאפ עם פליקס" הופעלה על ליד פייסבוק

## שורש הבעיה

האוטומציה הזו רשומה בטבלת `automations` עם `trigger_type: 'lead_created'`, למרות שהטריגר האמיתי בפלוו הוא `whatsapp_message_received`.

**מה קורה:**
1. ליד חדש נוצר (Ariel Boton) → `trigger-automation` נקרא עם `trigger_type: 'lead_created'`
2. שורה 306: `automations.trigger_type = 'lead_created'` → **נמצאת התאמה** לאוטומציה הזו
3. שורה 410: `is_flow = true` → מריץ את כל הצעדים ברצף **בלי לבדוק** את פילטרי הטריגר (group_id, keyword)
4. סוכן AI רץ, הודעת ווטסאפ נשלחת, משימה נוצרת — הכל לליד שלא קשור

**למה ה-fix של `source: 'crm'` לא מספיק:** הליד של Ariel הגיע דרך Pass 2 (Flow של "ליד חדש פרומו"), לא דרך Pass 1 CRM. אז `source` לא היה `'crm'`.

## הפתרון — שני תיקונים

### 1. `trigger-automation/index.ts` — בדיקת trigger step configuration לפני הרצת פלוו

בשורה ~410, לפני שמריצים flow steps, צריך **לאמת** שה-trigger step של הפלוו מתאים ל-payload:

```typescript
if (automation.is_flow) {
  // Validate trigger step matches payload BEFORE executing
  const triggerStep = flowSteps.find(s => s.step_type === 'trigger');
  if (triggerStep) {
    // If trigger step type doesn't match the incoming trigger_type, skip
    if (triggerStep.action_type && triggerStep.action_type !== payload.trigger_type) {
      console.log(`Flow trigger type mismatch: step=${triggerStep.action_type} vs payload=${payload.trigger_type}`);
      return;
    }
    // Apply trigger filters (group_id, keyword, etc.)
    // ... same filter logic as lines 333-360
  }
}
```

### 2. סנכרון `automations.trigger_type` בשמירת פלוו

ב-`FlowEditor.tsx` (או מקום השמירה), כשפלוו נשמר — לעדכן את `automations.trigger_type` לפי ה-`action_type` של ה-trigger step. ככה אוטומציות עם טריגר ווטסאפ לא ימצאו כלל בחיפוש `lead_created`.

### קבצים לעריכה:
1. **`supabase/functions/trigger-automation/index.ts`** — הוספת ולידציה של trigger step type + filters לפני הרצת פלוו
2. **`src/components/automations/FlowEditor.tsx`** — סנכרון `automations.trigger_type` מה-trigger step בעת שמירה

