/** Whether a client row is tagged as an SEO client (flag or services array). */
export function isSeoTaggedClient(client: {
  is_seo_client?: boolean | null;
  services?: unknown;
}): boolean {
  if (client.is_seo_client === true) return true;
  const services = client.services;
  return Array.isArray(services) && services.includes("seo");
}
