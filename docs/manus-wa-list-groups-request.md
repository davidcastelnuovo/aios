# Manus WA Gateway — list groups for Carmen instance

## Context
AIOS Carmen (phone ~972549696673) connects via Manus WhatsApp Gateway:
`https://whatsappgw-pzpyrrww.manus.space`

Green API (operator phone) is a **separate** channel for CRM chat / broadcasts — not Carmen.

## Required call (AIOS)

```http
GET https://whatsappgw-pzpyrrww.manus.space/api/v1/instances/{instanceId}/groups
X-Api-Key: <Carmen instance api key>
```

- Path **must** include `/api/v1`. Missing it (or wrong host) returns the SPA **HTML**.
- Without a valid `X-Api-Key` → **401** JSON `{ "success": false, "error": "Missing API key." }`.
- With a valid key → **200** JSON:

```json
{
  "success": true,
  "instanceId": "YwIn7GY3Ul3OAxXG",
  "groups": [
    { "id": "120363…@g.us", "subject": "Client Ops", "participantCount": 12 }
  ]
}
```

Only groups the **Manus instance** (Carmen’s number) is a member of. Never Green API operator groups.

## AIOS wiring

- Edge: `manus-wa-sync-groups` (also via `manus-wa-status?syncGroups=true` / `manage-manus-wa` action `sync_groups`)
- UI: Agent Hub → **הרשאות WhatsApp** → **סנכרן קבוצות מ-Manus**
- Upserts `whatsapp_groups` with `description='manus_wa_sync'` and stores catalog in
  `tenant_integrations.settings.manus_groups_sync`

## Optional admin variant

`GET /api/admin/instances/{instanceId}/groups` with `X-Worker-Secret` (same as status/QR).
