/**
 * Proxies public landing URLs to Supabase web-design-serve.
 * Env on Vercel project: SUPABASE_URL (e.g. https://xxx.supabase.co)
 */
export default async function handler(req, res) {
  const base = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  if (!base) {
    res.status(503).send("SUPABASE_URL not configured");
    return;
  }

  const url = new URL(req.url, `https://${req.headers.host}`);
  const tenantSlug = url.searchParams.get("tenant_slug") || "";
  const projectSlug = url.searchParams.get("project_slug") || "";
  let file = url.searchParams.get("file") || "index.html";
  if (Array.isArray(file)) file = file.join("/");
  const previewToken = url.searchParams.get("preview_token") || "";

  const upstream = new URL(`${base}/functions/v1/web-design-serve`);
  upstream.searchParams.set("tenant_slug", tenantSlug);
  upstream.searchParams.set("project_slug", projectSlug);
  upstream.searchParams.set("file", file);
  if (previewToken) upstream.searchParams.set("preview_token", previewToken);

  const response = await fetch(upstream.toString(), {
    headers: { Accept: "*/*" },
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  res.status(response.status);
  const contentType = response.headers.get("content-type");
  if (contentType) res.setHeader("Content-Type", contentType);
  res.send(buffer);
}
