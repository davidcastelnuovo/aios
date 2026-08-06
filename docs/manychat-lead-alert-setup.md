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
| **ManyChat Flow: Tag added → WhatsApp template** | **David (UI only)** | ⏳ **Blocking** (Flow exists: `ליד חדש ללקוח`) |
| Switch to `sendFlow` + field verify (no tag race) | AIOS code | ⏳ This PR |

## Delivery path (recommended)

AIOS now:
1. Finds/creates the **client** subscriber by `client_phone`
2. Writes all 5 custom fields (empty → `-`)
3. **Verifies** fields on the contact (retries once)
4. Calls **`sendFlow`** (`content20260805211918_552368` = Flow «ליד חדש ללקוח»)

The tag `aios_lead_alert` is optional cleanup only — **do not rely on Tag Applied** to send (race with stale fields).

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
