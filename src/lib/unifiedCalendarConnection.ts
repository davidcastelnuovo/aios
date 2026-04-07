import { supabase } from "@/integrations/supabase/client";

type WorkspaceIntegration = {
  name: string;
  type: string;
  icon_url: string | null;
  categories: string[];
};

type PendingConnection = {
  category: string;
  integration_type: string;
  tenant_id: string;
  flow_uid: string;
};

const normalize = (value?: string | null) => (value ?? "").trim().toLowerCase();

const getUnifiedCallbackUrl = () => {
  const tenantSlugMatch = window.location.pathname.match(/^\/t\/([^/]+)/);
  const callbackPath = tenantSlugMatch
    ? `/t/${tenantSlugMatch[1]}/unified-callback`
    : "/unified-callback";

  return new URL(callbackPath, window.location.origin);
};

const isCalendarCandidate = (integration: WorkspaceIntegration) => {
  const values = [integration.name, integration.type, ...integration.categories].map(normalize);
  return values.some((value) => value.includes("calendar"));
};

const rankCalendarCandidate = (integration: WorkspaceIntegration) => {
  const haystack = [integration.name, integration.type, ...integration.categories]
    .map(normalize)
    .join(" ");

  let score = 0;

  if (haystack.includes("google_calendar")) score += 10;
  if (haystack.includes("google calendar")) score += 8;
  if (haystack.includes("google")) score += 5;
  if (haystack.includes("calendar")) score += 3;

  return score;
};

async function getWorkspaceCalendarIntegration(tenantId: string) {
  const { data, error } = await supabase.functions.invoke("unified-connections", {
    body: {
      action: "list_workspace_integrations",
      tenant_id: tenantId,
    },
  });

  if (error) throw error;

  const integrations = (data?.integrations ?? []) as WorkspaceIntegration[];
  const candidates = integrations.filter(isCalendarCandidate);

  if (!candidates.length) {
    throw new Error("לא נמצאה אינטגרציית Google Calendar פעילה ב-Unified.");
  }

  return [...candidates].sort((a, b) => rankCalendarCandidate(b) - rankCalendarCandidate(a))[0];
}

export async function openUnifiedCalendarConnection({ tenantId }: { tenantId: string }) {
  if (!tenantId) throw new Error("לא נמצא ארגון פעיל.");

  const popup = window.open("about:blank", "unified-calendar-auth", "width=600,height=700,left=100,top=100");

  if (!popup) {
    throw new Error("חלון הקופץ נחסם. נא לאפשר חלונות קופצים ולנסות שוב.");
  }

  try {
    const integration = await getWorkspaceCalendarIntegration(tenantId);
    const category = integration.categories.find((value) => normalize(value).includes("calendar")) ?? integration.categories[0] ?? "calendar";
    const flowUid = crypto.randomUUID();
    const pendingConnection: PendingConnection = {
      category,
      integration_type: integration.type,
      tenant_id: tenantId,
      flow_uid: flowUid,
    };

    sessionStorage.setItem("unified_pending_connection", JSON.stringify(pendingConnection));

    const { data, error } = await supabase.functions.invoke("unified-connections", {
      body: {
        action: "get_embed_url",
        tenant_id: tenantId,
        category,
        integration_type: integration.type,
        success_redirect: getUnifiedCallbackUrl().toString(),
        failure_redirect: window.location.href,
        state: window.btoa(JSON.stringify(pendingConnection)),
        uid: flowUid,
      },
    });

    if (error) throw error;

    if (!data?.embed_url) {
      throw new Error("לא התקבל קישור חיבור מ-Unified.");
    }

    popup.location.href = data.embed_url;
  } catch (error) {
    try {
      popup.close();
    } catch {
      // noop
    }
    throw error;
  }
}

export async function findUnifiedCalendarConnectionId(tenantId: string) {
  const { data, error } = await supabase.functions.invoke("unified-connections", {
    body: {
      action: "list",
      tenant_id: tenantId,
    },
  });

  if (error) throw error;

  const connections = (data?.connections ?? []) as Array<{
    id: string;
    integration_type?: string;
    settings?: { unified_category?: string | null };
  }>;

  const calendarConnection = connections.find((connection) => {
    if (connection.integration_type === "unified_calendar") return true;
    return normalize(connection.settings?.unified_category).includes("calendar");
  });

  return calendarConnection?.id ?? null;
}

export function listenForUnifiedConnection(onConnected: () => void) {
  const handler = (event: MessageEvent) => {
    if (event.data?.type !== "unified-connected") return;

    window.removeEventListener("message", handler);
    onConnected();
  };

  window.addEventListener("message", handler);

  return () => window.removeEventListener("message", handler);
}