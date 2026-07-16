import { supabase } from "./supabase";

interface TenantOption {
  id: string;
  name: string;
  slug: string | null;
}

interface ClientOption {
  id: string;
  name: string;
}

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const loadingEl = el<HTMLDivElement>("loading");
const loginEl = el<HTMLFormElement>("login");
const mainEl = el<HTMLDivElement>("main");
const loginError = el<HTMLDivElement>("login-error");
const mainError = el<HTMLDivElement>("main-error");
const tenantInput = el<HTMLInputElement>("tenant-input");
const tenantList = el<HTMLDataListElement>("tenant-list");
const clientInput = el<HTMLInputElement>("client-input");
const clientList = el<HTMLDataListElement>("client-list");
const topicInput = el<HTMLInputElement>("topic-input");
const audioOnlyCheckbox = el<HTMLInputElement>("audio-only");
const modeSelect = el<HTMLSelectElement>("mode-select");
const cameraRow = el<HTMLLabelElement>("camera-row");
const cameraToggle = el<HTMLInputElement>("camera-toggle");

modeSelect.addEventListener("change", () => {
  cameraRow.classList.toggle("hidden", modeSelect.value !== "screen");
});

let tenants: TenantOption[] = [];
let clients: ClientOption[] = [];
let selectedTenantId: string | null = null;

function show(state: "loading" | "login" | "main") {
  loadingEl.classList.toggle("hidden", state !== "loading");
  loginEl.classList.toggle("hidden", state !== "login");
  mainEl.classList.toggle("hidden", state !== "main");
}

function showError(target: HTMLElement, message: string | null) {
  target.classList.toggle("hidden", !message);
  target.textContent = message ?? "";
}

function fillDatalist(list: HTMLDataListElement, names: string[]) {
  list.innerHTML = "";
  for (const name of names) {
    const opt = document.createElement("option");
    opt.value = name;
    list.appendChild(opt);
  }
}

const findByName = <T extends { name: string }>(items: T[], typed: string): T | null => {
  const q = typed.trim();
  if (!q) return null;
  return items.find((i) => i.name === q)
    ?? items.find((i) => i.name.toLowerCase() === q.toLowerCase())
    ?? null;
};

async function loadTenants(): Promise<TenantOption[]> {
  const { data, error } = await supabase
    .from("tenant_users")
    .select("tenant_id, tenants(id, name, slug)");
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
  return result.sort((a, b) => (a.name || "").localeCompare(b.name || "", "he"));
}

async function loadClients(tenantId: string) {
  clients = [];
  fillDatalist(clientList, []);
  // Only clients the team actually works with — active or onboarding.
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, status")
    .eq("tenant_id", tenantId)
    .in("status", ["active", "onboarding"])
    .order("name");
  if (error) {
    console.error("loadClients:", error);
    return;
  }
  clients = (data ?? []).map((c) => ({ id: c.id, name: c.name }));
  fillDatalist(clientList, clients.map((c) => c.name));

  const { lastClientId } = await chrome.storage.local.get("lastClientId");
  const last = clients.find((c) => c.id === lastClientId);
  clientInput.value = last?.name ?? "";
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

async function selectTenant(tenant: TenantOption) {
  selectedTenantId = tenant.id;
  tenantInput.value = tenant.name;
  await chrome.storage.local.set({ lastTenantId: tenant.id });
  await persistActiveTenant(tenant.id);
  await loadClients(tenant.id);
}

tenantInput.addEventListener("change", async () => {
  const tenant = findByName(tenants, tenantInput.value);
  if (tenant && tenant.id !== selectedTenantId) {
    await selectTenant(tenant);
  } else if (!tenant) {
    selectedTenantId = null;
    clients = [];
    fillDatalist(clientList, []);
    clientInput.value = "";
  }
});

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

  fillDatalist(tenantList, tenants.map((t) => t.name));

  // Preselect the org the user is ACTIVE on in the web app (user_active_tenant)
  // — with multiple orgs, an arbitrary default causes RLS clashes with the SPA.
  const { data: activeRow } = await supabase
    .from("user_active_tenant")
    .select("tenant_id")
    .maybeSingle();
  const { lastTenantId } = await chrome.storage.local.get("lastTenantId");
  const preferred = tenants.find((t) => t.id === activeRow?.tenant_id)
    ?? tenants.find((t) => t.id === lastTenantId)
    ?? (tenants.length === 1 ? tenants[0] : null);

  show("main");
  if (preferred) await selectTenant(preferred);
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

el<HTMLButtonElement>("logout-btn").addEventListener("click", async () => {
  await supabase.auth.signOut();
  show("login");
});

el<HTMLButtonElement>("start-btn").addEventListener("click", async () => {
  showError(mainError, null);

  const tenant = findByName(tenants, tenantInput.value);
  if (!tenant) {
    showError(mainError, "נא לבחור ארגון מהרשימה (הקלד ובחר מההשלמות)");
    return;
  }
  if (tenant.id !== selectedTenantId) await selectTenant(tenant);

  const typedClient = clientInput.value.trim();
  const client = findByName(clients, typedClient);
  if (typedClient && !client) {
    showError(mainError, `הלקוח "${typedClient}" לא נמצא ברשימת הפעילים — בחר מההשלמות או השאר ריק`);
    return;
  }
  await chrome.storage.local.set({ lastClientId: client?.id ?? "" });

  const params = new URLSearchParams({
    tenant: tenant.id,
    slug: tenant.slug ?? "",
    client: client?.id ?? "",
    clientName: client?.name ?? "",
    topic: topicInput.value.trim(),
    audioOnly: audioOnlyCheckbox.checked ? "1" : "",
    mode: modeSelect.value,
    camera: modeSelect.value === "screen" && cameraToggle.checked ? "1" : "",
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
