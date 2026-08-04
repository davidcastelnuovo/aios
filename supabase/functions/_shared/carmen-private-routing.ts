/** Re-export for Deno edge functions. Implementation in .mjs (Node-testable). */
export {
  digitsOnly,
  phoneTail9,
  phonesMatch,
  isPhoneInAllowedList,
  resolveInboundLidToPhone,
  shouldMarkResolvedLidAsOutgoing,
  pickPrivateCarmenTarget,
  outboundThirdPartyGuardDecision,
  buildPrivateRoutingAcceptanceCases,
} from './carmen-private-routing.mjs'
