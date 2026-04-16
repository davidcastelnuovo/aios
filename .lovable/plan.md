
## Plan: Send Report Update to Client via WhatsApp/Email

### Problem
The "שלח עדכון ללקוח" button currently opens a generic webhook URL dialog. The user wants it to:
1. Take a screenshot of only the summary tables (ecommerce + leads campaign summaries)
2. Open a dialog to choose delivery method (WhatsApp group / Email / Both)
3. Allow editing the target phone/group or choosing a different one
4. Allow adding accompanying text with the screenshot

### Technical Details

**1. Install `html-to-image` library**
- Used to capture DOM elements as PNG images
- Will add `ref` attributes to the summary table `<Card>` elements to target them for screenshot

**2. New component: `src/components/dynamic-tables/SendReportDialog.tsx`**
- Dialog with:
  - Preview of captured screenshot(s)
  - Delivery method selector: WhatsApp / Email / Both (checkboxes)
  - WhatsApp section: dropdown of tenant's WhatsApp groups (preselect client's linked group if available), editable phone field for direct send
  - Email section: email input (prefilled from client data if available)
  - Textarea for accompanying message text
  - Send button
- Fetches WhatsApp groups from `whatsapp_groups` table filtered by `tenant_id`
- Fetches client info (phone, email) from `clients` table using `table.client_id`

**3. Update `src/pages/DynamicTableView.tsx`**
- Add refs to the summary Card elements (ecommerce and lead campaign tables)
- Replace the webhook dialog state/logic with `SendReportDialog`
- On button click: capture summary tables as image using `html-to-image`, then open the dialog with the image
- Pass `table.client_id` and `table.tenant_id` to the dialog

**4. Sending logic**
- **WhatsApp**: Use existing `send-green-api-file` edge function — send the screenshot image as a file with the caption text, targeting either a group (`groupId`) or direct phone
- **Email**: Use existing `send-email` or create a simple edge function to send email with image attachment (check if email sending edge function exists)

**5. No database changes needed**
- All data (groups, clients) already exists
- Existing edge functions handle WhatsApp file sending
