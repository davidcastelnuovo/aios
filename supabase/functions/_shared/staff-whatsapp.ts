/** Re-export for Deno edge functions. Implementation in .mjs (Node-testable). */
export {
  digitsOnly,
  normalizeStaffPhone,
  isValidStaffPhone,
  scoreNameMatch,
  selectStaffMatch,
  formatStaffContact,
  buildStaffWhatsappAcceptanceCases,
} from './staff-whatsapp.mjs'
