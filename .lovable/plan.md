## Goal
Make the Manus WhatsApp Gateway a fully usable chat provider in the app — sending from the chat UI, badges on messages, and selectable in automations — so it can replace or run alongside Green API.

## 1. ChatView send routing (`src/components/chat/ChatView.tsx`)
- Extend the active-integration query to also include `manus_wa` in the `.in("integration_type", [...])` list.
- Broaden `activeProvider` type to include `'manus_wa'`.
- Add a third branch in the text-send handler that invokes `send-manus-wa-message` with `{ clientId, leadId, message, phoneNumber, integrationId }`.
- Add a file/image branch that invokes `send-manus-wa-file` (mirrors the existing `send-green-api-file` branch).
- Update the `active_chat_provider` write so converting an unknown contact while Manus is active sets it to `'manus_wa'`.
- Show Manus controls (or hide Green-API-only controls) when `activeProvider === 'manus_wa'`.

## 2. Provider badge (`src/components/chat/ChatProviderIndicator.tsx`)
- Add `'manus_wa'` to the `provider` union.
- Add a Manus badge variant (distinct color, "Manus WA" label, Phone icon) so inbound/outbound rows are visually distinguishable from Green API.

## 3. Multi-provider selection
When both Green API and Manus are active in the same tenant we need a deterministic pick:
- In ChatView's integration query, fetch all active WhatsApp-class integrations, not just the first.
- Add a small provider toggle in the chat header (segmented control: Green API / Manus WA) persisted in `localStorage` per tenant. Default = the only active one; if both active, default to last used.
- Pass the chosen `integrationId` into the invoke calls so the edge function uses the right credentials.

## 4. Convert-unknown-contact (`src/components/chat/ConvertContactDialog.tsx`)
- Add `'manus_wa'` to the `integration_type` `.in([...])` filter and to the union type so conversion works when Manus is the only provider.
- Verify the `convert-unknown-contact` edge function tolerates `manus_wa` as `active_chat_provider`; if it hard-codes providers, add the case.

## 5. Automations — WhatsApp send step (`src/components/automations/StepConfigPanel.tsx`)
- Where the panel filters `integration_type = 'green_api'` to populate the connection picker, change to `.in('integration_type', ['green_api','manus_wa'])` and show provider next to each option label.
- Add a `whatsapp_provider` field on the step config (`green_api` | `manus_wa`), defaulted from the selected integration.
- Update the automation runner (search for where `send-green-api-message` is invoked from automations — likely `supabase/functions/run-automation*` or similar) to branch on `whatsapp_provider` and call `send-manus-wa-message` / `send-manus-wa-file` accordingly. Pass `senderUserId` (service-role path is already supported).
- Mirror the same change in `AddAutomationForm.tsx` / `EditAutomationDialog.tsx` if they enumerate providers.

## 6. Inbound message provider tagging
- Confirm `manus-wa-webhook` already stamps `provider='manus_wa'` on inserted rows (it does per implementation summary). No change needed beyond verifying the badge renders.

## 7. QA checklist
- Disable Green API, keep only Manus active → chat send works, badge shows "Manus WA", inbound webhook lands in the right conversation.
- Both active → toggle in chat header switches provider; automations pick the configured one.
- Convert unknown contact dialog opens and converts under Manus-only mode.
- Automation "Send WhatsApp" step with `whatsapp_provider=manus_wa` delivers via Manus.

## Out of scope
- No DB schema changes (enum already has `manus_wa`).
- No new edge functions (existing `send-manus-wa-message`, `send-manus-wa-file`, `manus-wa-webhook` are reused).
- Does not touch GreenAPISettings or the Manus settings page.
