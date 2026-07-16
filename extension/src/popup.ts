import { supabase } from "./supabase";

interface TenantOption {
  id: string;
  name: string;
  slug: string | null;
}

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const loadingEl = el<HTMLDivElement>("loading");
const loginEl = el<HTMLFormElement>("login");
const mainEl = el<HTMLDivElement>("main");
const loginError = el<HTMLDivElement>("login-error");
const mainError = el<HTMLDivElement>("main-error");
const tenantSelect = el<HTMLSelectElement>("tenant-select");
const clientSelect = el<HTMLSelectElement>("client-select");
const topicInput = el<HTMLInputElement>("topic-input");
const audioOnlyCheckbox = el<HTMLInputElement>("audio-only");

let tenants: TenantOption[] = [];

function show(state: "loading" | "login" | "main") {
  loadingEl.classList.toggle("hidden", state !== "loading");
  loginEl.classList.toggle("hidden", state !== "login");
  mainEl.classList.toggle("hidden", state !== "main");
}

function showError(target: HTMLElement, message: string | null) {
  target.classList.toggle("hidden", !message);
  target.textContent = message ?? "";
}

async function loadTenants(): Promise<TenantOption[]> {
  const { data, error } = await supabase
    .from("tenant_users")
    .select("tenant_id, tenants(id, name, slug)")
    .order("tenant_id");
  if (error) throw error;
  const seen = new Set<string>();
  const result: TenantOption[] = [];
  for (const row of data ?? []) {
    const t = row.tenants as unknown as TenantOption | null;
    if (t && !seen.has(t.id)) {
      seen.add(t.id);
      result.push(t);
    }
  }
  return result;
}

async function loadClients(tenantId: string) {
  clientSelect.innerHTML = '<option value="">— ללא שיוך —</option>';
  const { data, error } = await supabase
    .from("clients")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .order("name");
  if (error) {
    console.error("loadClients:", error);
    return;
  }
  for (const client of data ?? []) {
    const opt = document.createElement("option");
    opt.value = client.id;
    opt.textContent = client.name;
    clientSelect.appendChild(opt);
  }
  const { lastClientId } = await chrome.storage.local.get("lastClientId");
  if (lastClientId && [...clientSelect.options].some((o) => o.value === lastClientId)) {
    clientSelect.value = lastClientId;
  }
}

// RLS on zoom_recordings/clients resolves the tenant via user_active_tenant
// (get_user_tenant_id), so switching tenants here must persist it — exactly
// like the SPA's TenantContext does.
async function persistActiveTenant(tenantId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("user_active_tenant")
    .upsert(
      { user_id: user.id, tenant_id: tenantId, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );
  if (error) console.error("persistActiveTenant:", error);
}

async function onTenantChange() {
  const tenantId = tenantSelect.value;
  if (!tenantId) return;
  await chrome.storage.local.set({ lastTenantId: tenantId });
  await persistActiveTenant(tenantId);
  await loadClients(tenantId);
}

async function initMain() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    show("login");
    return;
  }

  el<HTMLSpanElement>("user-email").textContent = session.user.email ?? "";

  try {
    tenants = await loadTenants();
  } catch (err) {
    show("main");
    showError(mainError, "שגיאה בטעינת ארגונים: " + (err instanceof Error ? err.message : String(err)));
    return;
  }

  if (tenants.length === 0) {
    show("main");
    showError(mainError, "המשתמש אינו משויך לאף ארגון");
    return;
  }

  tenantSelect.innerHTML = "";
  for (const tenant of tenants) {
    const opt = document.createElement("option");
    opt.value = tenant.id;
    opt.textContent = tenant.name;
    tenantSelect.appendChild(opt);
  }

  const { lastTenantId } = await chrome.storage.local.get("lastTenantId");
  if (lastTenantId && tenants.some((t) => t.id === lastTenantId)) {
    tenantSelect.value = lastTenantId;
  }

  show("main");
  await onTenantChange();
}

loginEl.addEventListener("submit", async (e) => {
  e.preventDefault();
  showError(loginError, null);
  const btn = el<HTMLButtonElement>("login-btn");
  btn.disabled = true;
  btn.textContent = "מתחבר...";
  const { error } = await supabase.auth.signInWithPassword({
    email: el<HTMLInputElement>("login-email").value.trim(),
    password: el<HTMLInputElement>("login-password").value,
  });
  btn.disabled = false;
  btn.textContent = "התחברות";
  if (error) {
    showError(loginError, "התחברות נכשלה: " + error.message);
    return;
  }
  await initMain();
});

tenantSelect.addEventListener("change", onTenantChange);

el<HTMLButtonElement>("logout-btn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  show("login");
});

el<HTMLButtonElement>("start-btn").addEventListener("click", async () => {
  showError(mainError, null);
  const tenantId = tenantSelect.value;
  if (!tenantId) {
    showError(mainError, "נא לבחור ארגון");
    return;
  }
  const tenant = tenants.find((t) => t.id === tenantId);
  const clientId = clientSelect.value;
  const clientName = clientId
    ? clientSelect.options[clientSelect.selectedIndex]?.textContent ?? ""
    : "";
  await chrome.storage.local.set({ lastClientId: clientId });

  const params = new URLSearchParams({
    tenant: tenantId,
    slug: tenant?.slug ?? "",
    client: clientId,
    clientName,
    topic: topicInput.value.trim(),
    audioOnly: audioOnlyCheckbox.checked ? "1" : "",
  });

  await chrome.windows.create({
    url: chrome.runtime.getURL(`recorder.html?${params.toString()}`),
    type: "popup",
    width: 440,
    height: 360,
  });
  window.close();
});

show("loading");
initMain();
