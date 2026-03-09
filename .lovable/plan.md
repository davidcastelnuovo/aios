

# Plan: Enhanced Lead Selection & Batch Automation Trigger

## Problem
The current "Test Flow" dialog only lets you pick a single lead manually from a combobox. The "Pull Lead" button in the trigger config only fetches the most recent lead. The user needs:
1. Filter leads by date range (yesterday, last week, custom)
2. Multi-select leads
3. Run the automation on all selected leads (batch)

## Changes

### 1. Enhance `TestFlowWithLeadDialog.tsx` — Date filters + Multi-select + Batch run

- Add date range filter tabs: "היום", "אתמול", "שבוע אחרון", "טווח מותאם"
- When a date range is selected, filter leads query by `created_at`
- Replace single-select combobox with a checkbox-based multi-select list
- Add "Select All" / "Deselect All" buttons
- Show count of selected leads
- Modify the test mutation to loop over all selected leads and invoke `trigger-automation` for each
- Show per-lead results (success/failure) in the results section
- Add a "pull from form" option that auto-selects all leads matching the Facebook form ID in the date range

### 2. Enhance `StepConfigPanel.tsx` — Pull lead with date range

- Add a small date range selector (dropdown: "אחרון", "היום", "אתמול", "שבוע אחרון") next to the "Pull Lead" button
- When pulling, use the selected date range instead of always fetching `.limit(1)`
- Show a list of matching leads (not just one) with the ability to browse them

## Technical Details

**Date filtering in query:**
```typescript
const now = new Date();
const filters = {
  today: startOfDay(now),
  yesterday: startOfDay(subDays(now, 1)),
  last_week: startOfDay(subDays(now, 7)),
};
// .gte("created_at", filters[range].toISOString())
```

**Batch trigger execution:**
```typescript
for (const leadId of selectedLeadIds) {
  const lead = leads.find(l => l.id === leadId);
  await supabase.functions.invoke("trigger-automation", {
    body: { automationId, tenant_id: tenantId, data: { ...leadData, lead_id: leadId } }
  });
}
```

**Files to edit:**
- `src/components/automations/TestFlowWithLeadDialog.tsx` — major rework for date filters, multi-select, batch run
- `src/components/automations/StepConfigPanel.tsx` — minor: date range for pull lead

