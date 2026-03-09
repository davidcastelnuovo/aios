

# Plan: Flow Automations Trigger Independently by Form ID

## Problem
The automation flow in MarketingCaptain has a trigger step configured with Facebook form ID `1952043998852618` (Promo form). But this form is **not** in the integration's `form_mappings` — only forms `1264130824999554` and `801103391720563` are mapped there. 

Currently, both `facebook-lead-webhook` and `cron-sync-facebook-leads` **only process leads from forms that exist in `form_mappings`**. If a form isn't mapped in the integration, the lead is completely ignored — no lead created, no automation triggered.

The user's requirement: **Flow trigger steps should work independently from integration form_mappings.** A flow can reference ANY form_id, and when a lead arrives from that form, the flow should trigger.

## Solution

### 1. `facebook-lead-webhook` — Add cross-tenant flow matching
**File:** `supabase/functions/facebook-lead-webhook/index.ts`

After the existing integration-based processing, add a second pass:
- Query `automation_flow_steps` for trigger steps where `configuration->>'facebook_form_id'` matches the incoming `form_id`
- For each matching step, get the automation's `tenant_id` and the `facebook_integration_id` from the step config (to get the access token)
- If the lead wasn't already created for that tenant by the integration logic, create it
- Trigger the automation for that tenant
- Use the integration referenced in the flow step config (`facebook_integration_id`) to get the access token for fetching lead data from Facebook

### 2. `cron-sync-facebook-leads` — Add flow-based form scanning
**File:** `supabase/functions/cron-sync-facebook-leads/index.ts`

After processing integration form_mappings, add:
- Query `automation_flow_steps` for active flow triggers with `facebook_form_id` set
- For each, check if that form_id is already covered by an integration's form_mappings for the same tenant — if so, skip (already processed)
- If not, use the `facebook_integration_id` from the step config to get the access token
- Fetch leads from Facebook for that form
- Create leads in the flow's tenant
- Trigger the automation

### 3. `trigger-automation` — Add form_id filtering for `lead_created` flows  
**File:** `supabase/functions/trigger-automation/index.ts`

In the flow trigger step matching logic (line ~329), add a filter for `facebook_form_id`:
- If the step config has `facebook_form_id`, check that `payloadData.facebook_form_id` matches
- Pass `facebook_form_id` in the trigger payload from both webhook and cron functions

## Data Flow

```text
Facebook Webhook → form_id = 1952043998852618

  Pass 1 (existing): Check integration form_mappings → NOT FOUND → skip
  
  Pass 2 (NEW): Check automation_flow_steps where 
    configuration->>'facebook_form_id' = '1952043998852618'
    → FOUND in MarketingCaptain tenant
    → Use facebook_integration_id from step config to get access token
    → Fetch lead data from Facebook
    → Create lead in MarketingCaptain tenant  
    → Trigger lead_created automation
```

## Key Details
- The flow trigger step already stores `facebook_integration_id` — this is used to resolve the access token
- Deduplication by `leadgen_id` in notes prevents double-creation
- No changes to the UI or flow editor needed — the trigger step already captures form_id

