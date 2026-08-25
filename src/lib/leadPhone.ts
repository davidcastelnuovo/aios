/** Phone search that treats 050… and 972… as the same number. */

export function digitsOnly(value: string | null | undefined): string {
  return (value || "").replace(/\D/g, "");
}

/** Last 9 digits when the query looks like a phone; otherwise null. */
export function phoneSearchNeedle(query: string): string | null {
  const digits = digitsOnly(query);
  if (digits.length < 8) return null;
  return digits.slice(-9);
}

export function leadMatchesPhoneSearch(
  phone: string | null | undefined,
  query: string,
): boolean {
  const needle = phoneSearchNeedle(query);
  const haystack = digitsOnly(phone);
  if (needle) return haystack.includes(needle);
  if (!query.trim()) return true;
  return (phone || "").includes(query.trim());
}

/** PostgREST `or()` clause for lead list/count queries. */
export function leadSearchOrFilter(query: string): string {
  const q = query.trim().replace(/,/g, " ");
  const needle = phoneSearchNeedle(q) || q;
  return [
    `contact_name.ilike.%${q}%`,
    `company_name.ilike.%${q}%`,
    `campaign_name.ilike.%${q}%`,
    `email.ilike.%${q}%`,
    `phone.ilike.%${needle}%`,
  ].join(",");
}
