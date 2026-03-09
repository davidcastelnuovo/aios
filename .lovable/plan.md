

# Plan: Visual Separation Between System Fields and Facebook Fields

## Problem
In the field mapping dropdowns and badge lists, system fields (contact_name, phone, email, etc.) and Facebook custom fields (fb_*) look the same, making it hard to distinguish between them.

## Changes

### File: `src/components/automations/StepConfigPanel.tsx`

#### 1. Field Select dropdown (line ~596-601)
Add visual grouping and color differentiation:
- Split `availableFields` into system fields and fb_ fields
- Render system fields first, then a separator, then fb_ fields with a distinct style
- Use `SelectGroup` + `SelectLabel` for group headers
- Apply a different background/text color to fb_ items (e.g., `bg-blue-50 text-blue-700` or similar)

#### 2. Badge variable list (line ~2062-2072)
Apply color differentiation to badges:
- System field badges: current style (`variant="outline"`)
- Facebook field badges: colored variant (e.g., `bg-blue-100 text-blue-800 border-blue-200`)
- Add a small label separator between the groups ("שדות מערכת" / "שדות פייסבוק")

#### 3. Available fields text display (line ~375)
Group the variables text by type for clarity.

### Detection Logic
Simple: any field with key starting with `fb_` is a Facebook field, everything else is a system field.

