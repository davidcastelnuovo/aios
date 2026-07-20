import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

Deno.serve(async (request) => {
  try {
  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return reply({ error: "method_not_allowed" }, 405);

  const authHeader = request.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!token || !supabaseUrl || !serviceKey) return reply({ error: "unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return reply({ error: "unauthorized" }, 401);

  const body = await request.json().catch(() => ({}));
  const tenantId = typeof body?.tenant_id === "string" ? body.tenant_id : "";
  const action = typeof body?.action === "string" ? body.action : "test";
  if (!tenantId) return reply({ error: "tenant_id_required" }, 400);

  const [{ data: membership }, { data: superAdmin }] = await Promise.all([
    admin.from("tenant_users").select("user_id").eq("tenant_id", tenantId).eq("user_id", authData.user.id).maybeSingle(),
    admin.rpc("is_super_admin", { _user_id: authData.user.id }),
  ]);
  if (!membership && superAdmin !== true) return reply({ error: "forbidden" }, 403);

  const ionosKey = (Deno.env.get("IONOS_API_KEY") ?? "").trim();
  const vercelToken = (Deno.env.get("VERCEL_TOKEN") ?? "").trim();
  const teamId = "team_anYCth1AhJ3ZrgT0tJGvv63t";
  const templateProjectId = "prj_rNR7SGvwcSFTMDTauQQlNqabmZLD";
  const result: Record<string, unknown> = {
    ionos: { configured: Boolean(ionosKey), connected: false },
    vercel: { configured: Boolean(vercelToken), connected: false, project_access: false },
  };

  if (ionosKey) {
    const response = await fetch("https://api.hosting.ionos.com/dns/v1/zones", {
      headers: { "X-API-Key": ionosKey, Accept: "application/json" },
    });
    const responseText = await response.text();
    let zones: unknown = [];
    if (response.ok && responseText.trim()) {
      try {
        zones = JSON.parse(responseText);
      } catch {
        zones = [];
      }
    }
    result.ionos = {
      configured: true,
      connected: response.ok,
      status: response.status,
      error: response.ok ? null : responseText.slice(0, 300),
      response_format: response.ok && responseText.trim() && !Array.isArray(zones) ? "unexpected" : "ok",
      paperlief_found: Array.isArray(zones) && zones.some((zone) => String(zone?.zoneName ?? zone?.name ?? "").replace(/\.$/, "").toLowerCase() === "paperlief.com"),
      zone_count: Array.isArray(zones) ? zones.length : 0,
    };
  }

  if (vercelToken) {
    const headers = { Authorization: `Bearer ${vercelToken}`, Accept: "application/json" };
    const [accountResponse, projectResponse] = await Promise.all([
      fetch("https://api.vercel.com/v2/user", { headers }),
      fetch("https://api.vercel.com/v9/projects/prj_rNR7SGvwcSFTMDTauQQlNqabmZLD?teamId=team_anYCth1AhJ3ZrgT0tJGvv63t", { headers }),
    ]);
    result.vercel = {
      configured: true,
      connected: accountResponse.ok,
      status: accountResponse.status,
      project_access: projectResponse.ok,
      project_status: projectResponse.status,
    };
  }

  if (action === "list_projects") {
    if (!vercelToken) return reply({ success: false, error: "vercel_credentials_missing" }, 400);
    const response = await fetch(`https://api.vercel.com/v9/projects?teamId=${teamId}&limit=100`, { headers: { Authorization: `Bearer ${vercelToken}`, Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return reply({ success: false, error: "vercel_projects_failed", status: response.status }, 400);
    const projects = await Promise.all((payload?.projects ?? []).map(async (project: Record<string, unknown>) => {
      const projectId = String(project.id ?? "");
      const [domainsResponse, deploymentsResponse] = await Promise.all([
        fetch(`https://api.vercel.com/v9/projects/${projectId}/domains?teamId=${teamId}&limit=100`, { headers: { Authorization: `Bearer ${vercelToken}`, Accept: "application/json" } }),
        fetch(`https://api.vercel.com/v6/deployments?projectId=${projectId}&teamId=${teamId}&limit=1`, { headers: { Authorization: `Bearer ${vercelToken}`, Accept: "application/json" } }),
      ]);
      const domainsPayload = await domainsResponse.json().catch(() => ({}));
      const deploymentsPayload = await deploymentsResponse.json().catch(() => ({}));
      const deployment = deploymentsPayload?.deployments?.[0] ?? null;
      return {
        id: project.id,
        name: project.name,
        framework: project.framework,
        updated_at: project.updatedAt,
        domains: (domainsPayload?.domains ?? []).map((domain: Record<string, unknown>) => ({ name: domain.name, verified: domain.verified })),
        deployment: deployment ? { id: deployment.uid, url: deployment.url, state: deployment.state, created_at: deployment.created } : null,
      };
    }));
    return reply({ success: true, projects });
  }

  if (action === "create_site") {
    if (!vercelToken) return reply({ success: false, error: "vercel_credentials_missing" }, 400);
    const requestedName = String(body?.name ?? "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!requestedName) return reply({ success: false, error: "site_name_required" }, 400);
    const headers = { Authorization: `Bearer ${vercelToken}`, Accept: "application/json", "Content-Type": "application/json" };
    const existingResponse = await fetch(`https://api.vercel.com/v9/projects/${requestedName}?teamId=${teamId}`, { headers });
    let project = existingResponse.ok ? await existingResponse.json().catch(() => ({})) : null;
    if (!project) {
      const projectResponse = await fetch(`https://api.vercel.com/v10/projects?teamId=${teamId}`, { method: "POST", headers, body: JSON.stringify({ name: requestedName, framework: "astro" }) });
      project = await projectResponse.json().catch(() => ({}));
      if (!projectResponse.ok) return reply({ success: false, error: "vercel_create_project_failed", status: projectResponse.status, detail: project?.error?.message }, 400);
    }
    const currentDeploymentsResponse = await fetch(`https://api.vercel.com/v6/deployments?projectId=${project.id}&teamId=${teamId}&limit=1&state=READY`, { headers });
    const currentDeployments = await currentDeploymentsResponse.json().catch(() => ({}));
    const currentDeployment = currentDeployments?.deployments?.[0];
    if (currentDeployment) return reply({ success: true, existing: true, project: { id: project.id, name: project.name }, deployment: { id: currentDeployment.uid, url: currentDeployment.url, status: currentDeployment.state } });
    const deploymentsResponse = await fetch(`https://api.vercel.com/v6/deployments?projectId=${templateProjectId}&teamId=${teamId}&limit=1&state=READY`, { headers });
    const deployments = await deploymentsResponse.json().catch(() => ({}));
    const templateDeploymentId = deployments?.deployments?.[0]?.uid;
    if (!templateDeploymentId) return reply({ success: false, error: "template_deployment_missing", project }, 400);
    const deployResponse = await fetch(`https://api.vercel.com/v13/deployments?teamId=${teamId}`, { method: "POST", headers, body: JSON.stringify({ name: requestedName, project: project.id, deploymentId: templateDeploymentId, target: "production" }) });
    const deployment = await deployResponse.json().catch(() => ({}));
    if (!deployResponse.ok) return reply({ success: false, error: "vercel_deploy_site_failed", status: deployResponse.status, detail: deployment?.error?.message, project }, 400);
    return reply({ success: true, existing: false, project: { id: project.id, name: project.name }, deployment: { id: deployment.id, url: deployment.url, status: deployment.status ?? deployment.readyState } });
  }

  if (action === "connect") {
    if (!ionosKey || !vercelToken) return reply({ success: false, error: "provider_credentials_missing", ...result }, 400);

    const domain = String(body?.domain ?? "paperlief.com").trim().replace(/^https?:\/\//, "").replace(/\/$/, "").toLowerCase();
    const projectId = String(body?.project_id ?? templateProjectId);
    if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(domain)) return reply({ success: false, error: "invalid_domain" }, 400);
    const vercelHeaders = { Authorization: `Bearer ${vercelToken}`, Accept: "application/json", "Content-Type": "application/json" };
    const addDomainResponse = await fetch(`https://api.vercel.com/v10/projects/${projectId}/domains?teamId=${teamId}`, {
      method: "POST",
      headers: vercelHeaders,
      body: JSON.stringify({ name: domain }),
    });
    const addDomainText = await addDomainResponse.text();
    if (!addDomainResponse.ok && addDomainResponse.status !== 409) {
      return reply({ success: false, error: "vercel_add_domain_failed", status: addDomainResponse.status, detail: addDomainText.slice(0, 500), ...result }, 400);
    }

    const configResponse = await fetch(`https://api.vercel.com/v6/domains/${domain}/config?projectIdOrName=${projectId}&teamId=${teamId}`, {
      headers: vercelHeaders,
    });
    const configText = await configResponse.text();
    if (!configResponse.ok) return reply({ success: false, error: "vercel_domain_config_failed", status: configResponse.status, detail: configText.slice(0, 500), ...result }, 400);
    const config = JSON.parse(configText);
    const rankedIps = Array.isArray(config?.recommendedIPv4) ? [...config.recommendedIPv4].sort((a, b) => Number(a?.rank ?? 99) - Number(b?.rank ?? 99)) : [];
    const ipValue = Array.isArray(rankedIps[0]?.value) ? rankedIps[0].value[0] : rankedIps[0]?.value;
    if (typeof ipValue !== "string" || !/^\d{1,3}(\.\d{1,3}){3}$/.test(ipValue)) {
      return reply({ success: false, error: "vercel_dns_recommendation_missing", detail: "No recommended IPv4 was returned", ...result }, 400);
    }

    const ionosHeaders = { "X-API-Key": ionosKey, Accept: "application/json", "Content-Type": "application/json" };
    const zonesResponse = await fetch("https://api.hosting.ionos.com/dns/v1/zones", { headers: ionosHeaders });
    const zonesText = await zonesResponse.text();
    if (!zonesResponse.ok) return reply({ success: false, error: "ionos_zones_failed", status: zonesResponse.status, detail: zonesText.slice(0, 500), ...result }, 400);
    const zones = JSON.parse(zonesText);
    const zone = Array.isArray(zones) ? zones.find((item) => String(item?.name ?? item?.zoneName ?? "").replace(/\.$/, "").toLowerCase() === domain) : null;
    if (!zone?.id) return reply({ success: false, error: "ionos_zone_not_found", detail: domain, ...result }, 404);

    const record = { name: domain, type: "A", content: ipValue, ttl: 3600, prio: 0, disabled: false };
    const recordsResponse = await fetch(`https://api.hosting.ionos.com/dns/v1/zones/${zone.id}?recordName=${encodeURIComponent(domain)}&recordType=A`, { headers: ionosHeaders });
    const recordsText = await recordsResponse.text();
    if (!recordsResponse.ok) return reply({ success: false, error: "ionos_records_read_failed", status: recordsResponse.status, detail: recordsText.slice(0, 500), ...result }, 400);
    const zoneDetails = recordsText.trim() ? JSON.parse(recordsText) : {};
    const currentRecords = Array.isArray(zoneDetails?.records) ? zoneDetails.records : [];
    const alreadyConfigured = currentRecords.some((item) => String(item?.name ?? "").replace(/\.$/, "").toLowerCase() === domain && item?.type === "A" && item?.content === ipValue && item?.disabled !== true);

    let dnsStatus = 200;
    if (!alreadyConfigured) {
      const hasApexA = currentRecords.some((item) => String(item?.name ?? "").replace(/\.$/, "").toLowerCase() === domain && item?.type === "A");
      const dnsResponse = await fetch(`https://api.hosting.ionos.com/dns/v1/zones/${zone.id}${hasApexA ? "" : "/records"}`, {
        method: hasApexA ? "PATCH" : "POST",
        headers: ionosHeaders,
        body: JSON.stringify([record]),
      });
      dnsStatus = dnsResponse.status;
      const dnsText = await dnsResponse.text();
      if (!dnsResponse.ok) return reply({ success: false, error: "ionos_dns_write_failed", status: dnsResponse.status, detail: dnsText.slice(0, 500), ...result }, 400);
    }

    return reply({
      success: true,
      connected: true,
      domain,
      vercel: { added: addDomainResponse.ok, already_added: addDomainResponse.status === 409, config_status: configResponse.status },
      ionos: { zone_id: zone.id, record_type: "A", record_value: ipValue, already_configured: alreadyConfigured, write_status: dnsStatus },
      propagation: "pending",
    });
  }

  return reply({ success: true, ...result });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown_error";
    console.error("domain-connections failed", detail);
    return reply({
      success: false,
      error: "domain_connection_check_failed",
      detail,
      ionos: { configured: Boolean((Deno.env.get("IONOS_API_KEY") ?? "").trim()), connected: false, error: detail },
      vercel: { configured: Boolean((Deno.env.get("VERCEL_TOKEN") ?? "").trim()), connected: false, project_access: false },
    });
  }
});
