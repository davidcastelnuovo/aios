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

## What you still create in ManyChat (UI only)

ManyChat does not let the API build a WhatsApp-template Flow. One Flow is enough:

1. **Automations → New automation**
2. Trigger: **Tag added** → choose `aios_lead_alert`
3. Action: **Send WhatsApp Message** → template `new_lead_alert_he` / `lead_alert_compact_he`
4. Map template variables:
   - `{{1}}` → User field `client_name`
   - `{{2}}` → User field `lead_name`
   - `{{3}}` → User field `lead_phone`
   - `{{4}}` → User field `lead_email`
   - `{{5}}` → User field `form_qa_summary`
5. Publish / activate

Optional cleanup step after send: **Remove tag** `aios_lead_alert` so the same contact can be alerted again later.

## AIOS automation config (ready to apply)

```json
{
  "manychat_tag_id": "93553458",
  "custom_fields": [
    { "field_id": 14845212, "field_name": "client_name", "value_template": "{{client_name}}" },
    { "field_id": 14845211, "field_name": "lead_name", "value_template": "{{lead_name}}" },
    { "field_id": 14845213, "field_name": "lead_phone", "value_template": "{{lead_phone}}" },
    { "field_id": 14845214, "field_name": "lead_email", "value_template": "{{lead_email}}" },
    { "field_id": 14845215, "field_name": "form_qa_summary", "value_template": "{{form_qa_summary}}" }
  ]
}
```

After the Flow is live, switch the Make lead-alert step from `send_meta_whatsapp_message` to `send_whatsapp` with the config above (recipient = client WhatsApp subscriber / `client_phone`).
