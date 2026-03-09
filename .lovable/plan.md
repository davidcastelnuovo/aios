

# תוכנית: תיקון הזנה ידנית כך שתדמה ליד מפייסבוק

## הבעיה
1. **בקאנד**: כשנשלח `data.phone` ישירות (ללא `lead_id`), הפונקציה `executeGreenApiMessage` לא משתמשת בו — היא מנסה לשלוף ליד מה-DB ונכשלת
2. **פרונטאנד**: ההזנה הידנית שולחת שדות מערכת רגילים (`phone`, `contact_name`) אבל כשהטריגר הוא "ליד מפייסבוק", הנתונים שמגיעים בפועל כוללים שדות `fb_` (כמו `fb_phone`, `fb_full_name`) — מה שגורם לאי-התאמה במיפוי המשתנים

## שינויים

### 1. Backend: `supabase/functions/trigger-automation/index.ts`
בפונקציה `executeGreenApiMessage`, בקטע ה-default (שורה ~1942-1966), להוסיף fallback ל-`data.phone` ישירות **לפני** שזורקים שגיאה:

```typescript
// Default: send to contact (lead/client)
let contactPhone: string | null = null

if (data.lead_id || data.id) {
  // ... existing DB lookup
} else if (data.client_id) {
  // ... existing DB lookup
}

// NEW: Fallback to phone directly from data (manual test / webhook)
if (!contactPhone && data.phone) {
  contactPhone = data.phone
}

if (!contactPhone) {
  throw new Error('לא נמצא מספר טלפון לשליחה')
}
```

### 2. Frontend: `src/components/automations/TestFlowWithLeadDialog.tsx`
- לזהות מהטריגר אם מדובר בליד מפייסבוק (`inbound_webhook_lead` / `lead_created`)
- כשהטריגר הוא פייסבוק: לשלוח את השדות גם עם קידומת `fb_` (למשל `fb_phone`, `fb_full_name`, `fb_email`) בנוסף לשדות הרגילים
- כשהטריגר הוא ליד מהמערכת: להשאיר כמו שזה

בקטע ה-mutation (שורה ~268-286), להוסיף:
```typescript
if (inputMode === "manual") {
  const testData: any = {
    test: true,
    manual: true,
    contact_name: manualData.contact_name || manualData.company_name,
    company_name: manualData.company_name,
    phone: manualData.phone,
    email: manualData.email,
    source: manualData.source || "facebook",
    notes: manualData.notes,
  };
  
  // If trigger is Facebook/webhook, add fb_ prefixed fields
  if (isFacebookTrigger) {
    testData.fb_phone = manualData.phone;
    testData.fb_full_name = manualData.contact_name;
    testData.fb_email = manualData.email;
    // Append fb_ fields to notes like real FB leads
    const fbNotes = Object.entries(testData)
      .filter(([k]) => k.startsWith('fb_') && testData[k])
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n');
    if (fbNotes) testData.notes = (testData.notes ? testData.notes + '\n' : '') + fbNotes;
  }
}
```

### קבצים לעריכה:
- `supabase/functions/trigger-automation/index.ts` — fallback ל-data.phone
- `src/components/automations/TestFlowWithLeadDialog.tsx` — הוספת שדות fb_ אוטומטית לפי סוג טריגר

