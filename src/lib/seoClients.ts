export function isSeoTaggedClient(client: {
  is_seo_client?: boolean | null;
  services?: string[] | null | unknown;
}) {
  if (client.is_seo_client === true) return true;
  if (!Array.isArray(client.services)) return false;
  return client.services.includes("seo");
}
