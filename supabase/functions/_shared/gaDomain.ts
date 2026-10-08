/** Host compare for Analytics property names, account names, and stream URLs. */
export function normalizeGaHost(value?: string | null): string {
  let v = String(value || "")
    .trim()
    .toLowerCase();
  if (!v) return "";
  v = v.replace(/^sc-domain:/, "");
  v = v.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  v = v.split("/")[0]?.split("?")[0]?.split("#")[0] || "";
  v = v.replace(/:\d+$/, "");
  v = v.replace(/^www\./, "");
  return v;
}

export function gaHostsMatch(a?: string | null, b?: string | null): boolean {
  const na = normalizeGaHost(a);
  const nb = normalizeGaHost(b);
  if (!na || !nb) return false;
  return na === nb || na.endsWith(`.${nb}`) || nb.endsWith(`.${na}`);
}

export function listedPropertyMatchesDomain(
  property: {
    name?: string | null;
    accountName?: string | null;
    websiteUrl?: string | null;
  },
  domain: string,
): boolean {
  return (
    gaHostsMatch(property.name, domain) ||
    gaHostsMatch(property.accountName, domain) ||
    gaHostsMatch(property.websiteUrl, domain)
  );
}
