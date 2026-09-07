/** Normalize local-part + domain; auto-fix when user entered them reversed. */
export function normalizeSenderEmailParts(
  local: string,
  domain: string,
): { default_local: string; domain: string; wasSwapped: boolean } {
  let default_local = (local || "noreply").trim().toLowerCase();
  let domainNorm = (domain || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");

  const looksLikeVerifiedDomain = (value: string) =>
    /\.(co\.il|org\.il|ac\.il|gov\.il|com|net|org|io|co)$/i.test(value);

  if (looksLikeVerifiedDomain(default_local) && !looksLikeVerifiedDomain(domainNorm)) {
    const swappedLocal = domainNorm || "noreply";
    const swappedDomain = default_local;
    return { default_local: swappedLocal, domain: swappedDomain, wasSwapped: true };
  }

  return {
    default_local: default_local || "noreply",
    domain: domainNorm,
    wasSwapped: false,
  };
}

export function formatSenderEmail(default_local: string, domain: string) {
  return `${default_local}@${domain}`;
}
