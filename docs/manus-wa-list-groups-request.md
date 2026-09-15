# Manus WA Gateway — request: list groups for Carmen instance

## Context
AIOS Carmen (phone ~972549696673) connects via Manus WhatsApp Gateway:
`https://whatsappgw-pzpyrrww.manus.space`

Today we only use:
- `GET /api/v1/instances/{id}/status`
- `POST /api/v1/instances/{id}/send/text`
- `POST /api/v1/instances/{id}/send/group`
- `POST /api/v1/instances/{id}/send/file`
- Admin: create instance, QR token, status

Green API (operator phone) is a **separate** channel for CRM chat / broadcasts — not Carmen.

## Status (2026-09-15)
Implemented in AIOS via edge function `manus-wa-sync-groups` → `GET /api/v1/instances/{id}/groups`.
Agent Hub → **הרשאות WhatsApp** → **סנכרן קבוצות מ-Manus** upserts `whatsapp_groups` and stores JIDs in `tenant_integrations.settings.manus_groups_sync`.

## Problem (historical)
Before the gateway exposed list-groups, we only learned a group after inbound webhook traffic.

## Requested API

### `GET /api/v1/instances/{instanceId}/groups`
Auth: same as send — `X-Api-Key: <instance api key>`

Response (example):
```json
{
  "groups": [
    {
      "id": "120363xxxxxxxxxxxx@g.us",
      "name": "Client Ops",
      "participantsCount": 12
    }
  ]
}
```

Requirements:
- Only groups the **Manus instance** (Carmen’s number) is currently a member of
- Stable `id` = WhatsApp JID (`…@g.us`)
- Preferable: pagination (`limit` / `cursor`) if the list is large
- Optional later: `GET …/groups/{id}` with participants

### Optional admin variant
`GET /api/admin/instances/{instanceId}/groups` with `X-Worker-Secret` (same as status/QR).

## Why
AIOS will call this from `manage-manus-wa` / a sync job, upsert into `whatsapp_groups` tagged as Manus-sourced, and show that list in Carmen conversation permissions — never Green API operator groups.

## Acceptance
1. Call with Carmen’s instance API key returns her membership groups.
2. Group JIDs match what webhooks already send as `groupId` / `@g.us` chat ids.
3. Documented in gateway OpenAPI / README.
