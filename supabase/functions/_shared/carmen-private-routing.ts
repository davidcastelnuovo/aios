/** Re-export for Deno edge functions. Implementation in .mjs (Node-testable). */
export {
  digitsOnly,
  phoneTail9,
  phonesMatch,
  isPhoneInAllowedList,
  looksLikeRealPhone,
  isUsableLidKey,
  pickInboundLidDigits,
  pickGroupAuthorLidDigits,
  pickPayloadRealPhone,
  resolveInboundLidToPhone,
  shouldMarkResolvedLidAsOutgoing,
  pickPrivateCarmenTarget,
  outboundThirdPartyGuardDecision,
  buildPrivateRoutingAcceptanceCases,
} from './carmen-private-routing.mjs'
