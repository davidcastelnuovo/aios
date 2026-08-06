# ManyChat lead-alert setup (DMM 77)

AIOS already created these via the ManyChat API on page **DMM-WA**:

| Custom field | Field ID | Maps from AIOS |
|---|---|---|
| `client_name` | `14845212` | `{{client_name}}` |
| `lead_name` | `14845211` | `{{lead_name}}` |
| `lead_phone` | `14845213` | `{{lead_phone}}` |
| `lead_email` | `14845214` | `{{lead_email}}` |
| `form_qa_summary` | `14845215` | `{{form_qa_summary}}` |

Tag: **`aios_lead_alert`** (ID `93553458`)

Automation: **התראת ליד ללקוח מ-Make / Webhook** (`314a7c5a-d7e3-4b24-9a18-095615906e08`)

## Status checklist

| Step | Owner | Status |
|---|---|---|
| Custom fields + tag in ManyChat | AIOS API | ✅ Done |
| `send_whatsapp` supports `custom_fields` + `phone_field=client_phone` | AIOS code | ✅ Done |
| Flow builder UI: tag / phone field / “מלא התראת ליד” | AIOS UI | ✅ Done |
| removeTag before addTag (repeat alerts re-fire) | AIOS code | ✅ Done |
| Switch to tag delivery + field resync | AIOS code | ✅ Done |
| **ManyChat Flow: Set Fields + Delay + template map** | **David (UI)** | ⏳ **Blocking** |

📖 **מדריך צעד-אחר-צעד:** [manychat-flow-remap-guide.md](./manychat-flow-remap-guide.md)

## Delivery path (recommended)

AIOS now:
1. Finds/creates the **client** subscriber by `client_phone`
2. Clears + writes all 5 custom fields (empty → `-`)
3. **Verifies** fields on the contact (retries + stable reads)
4. **Adds tag** `aios_lead_alert` (remove first) so the ManyChat Flow runs

The Flow **must** re-map fields before sending the template (see below). Do **not** rely on `sendFlow` alone for existing contacts — ManyChat can send stale template variables.

## ManyChat Flow: required steps before template

Edit Flow **«ליד חדש ללקוח»** (or the automation triggered by tag `aios_lead_alert`):

1. **Trigger:** Tag applied → `aios_lead_alert` (AIOS adds this tag after writing fields)
2. **Actions (before template):** Set Custom Field for each user field — forces refresh on existing contacts:
   - `lead_name` ← User Field `lead_name`
   - `lead_phone` ← User Field `lead_phone`
   - `lead_email` ← User Field `lead_email`
   - `client_name` ← User Field `client_name`
   - `form_qa_summary` ← User Field `form_qa_summary`
3. **Smart Delay:** 10 seconds (ManyChat minimum for Smart Delay)
4. **Send WhatsApp template** `new_lead_alert_he` with mapping:
   - `{{1}}` → `client_name`
   - `{{2}}` → `lead_name`
   - `{{3}}` → `lead_phone`
   - `{{4}}` → `lead_email`
   - `{{5}}` → `form_qa_summary`
5. Optional: Remove tag `aios_lead_alert` after send

Without steps 2–3, existing subscribers keep showing the **previous lead's** parameters.

**→ מדריך מפורט עם צעדים, טבלאות ודיאגרמה:** [manychat-flow-remap-guide.md](./manychat-flow-remap-guide.md)

## What you still need in ManyChat (UI only)

ManyChat does not let the API build a WhatsApp-template Flow. One automation is enough:

1. **Automations → New automation** (Rules / Custom trigger)
2. Trigger: **Tag applied** → choose `aios_lead_alert`
3. Action: **Send WhatsApp Message** → template used for lead alerts  
   Prefer the same copy as Meta: `new_lead_alert_he` / `lead_alert_compact_he`  
   (must exist & be APPROVED on the **DMM-WA / 77** WhatsApp channel in ManyChat)
4. Map template variables (**double-check — wrong map shows campaign name under שם**):
   - `{{1}}` → User field `client_name` (שם קמפיין/לקוח)
   - `{{2}}` → User field `lead_name` (שם הליד — לא client_name)
   - `{{3}}` → User field `lead_phone`
   - `{{4}}` → User field `lead_email`
   - `{{5}}` → User field `form_qa_summary`
5. Set the rule to allow **multiple times** per contact (not once-only)
6. Optional cleanup: **Remove tag** `aios_lead_alert` after send  
   (AIOS also removes the tag before re-adding, so either side is enough)
7. Publish / activate

When the Flow is live — tell AIOS/Cursor and we’ll switch the Make automation + probe one test lead to your phone.

## AIOS automation config (ready to apply)

```json
{
  "manychat_flow_ns": "content20260805211918_552368",
  "manychat_tag_id": "93553458",
  "phone_mode": "field",
  "phone_field": "client_phone",
  "custom_fields": [
    { "field_id": 14845212, "field_name": "client_name", "value_template": "{{client_name}}" },
    { "field_id": 14845211, "field_name": "lead_name", "value_template": "{{lead_name}}" },
    { "field_id": 14845213, "field_name": "lead_phone", "value_template": "{{lead_phone}}" },
    { "field_id": 14845214, "field_name": "lead_email", "value_template": "{{lead_email}}" },
    { "field_id": 14845215, "field_name": "form_qa_summary", "value_template": "{{form_qa_summary}}" }
  ]
}
```

In the Flow Builder: change the send step action to **שלח WhatsApp (ManyChat)** and click **מלא התראת ליד (DMM)**, or apply the JSON above.

## Why phone_field matters

Make/Webhook payloads look like:

- `client_phone` = who should get the alert (the client **or** a campaigner testing on their own number)
- `phone` / `lead_phone` = the new lead

`client_phone` in the webhook **always overrides** the CRM client phone when present — so campaigners can test the same client with different numbers and each number gets its own ManyChat contact + the current dynamic fields.

Without `phone_field=client_phone`, ManyChat would look up the **lead** (or fail). That field is required for this automation.

## Probe plan (after switch)

1. Keep Meta step until ManyChat Flow is confirmed.
2. Switch step → `send_whatsapp` with config above.
3. Fire one test webhook to David’s WhatsApp (`972507677613`) or a safe client.
4. Confirm: ManyChat subscriber fields filled → tag applied → template delivered from **DMM 77**.
5. Only then leave Meta disconnected for this automation.
