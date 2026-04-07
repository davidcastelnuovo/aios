import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

type PendingConnection = {
  category?: string;
  integration_type?: string;
  tenant_id?: string;
  flow_uid?: string;
};

const readPendingConnection = (): PendingConnection | null => {
  const readFromStorage = (storage?: Storage | null) => {
    if (!storage) return null;

    try {
      const raw = storage.getItem("unified_pending_connection");
      return raw ? (JSON.parse(raw) as PendingConnection) : null;
    } catch {
      return null;
    }
  };

  const currentWindowData = readFromStorage(window.sessionStorage);
  if (currentWindowData) return currentWindowData;

  try {
    return readFromStorage(window.opener?.sessionStorage);
  } catch {
    return null;
  }
};

const decodeState = (value: string | null): PendingConnection | null => {
  if (!value) return null;

  try {
    return JSON.parse(window.atob(value)) as PendingConnection;
  } catch {
    return null;
  }
};

export default function UnifiedCallback() {
  const [status, setStatus] = useState<"saving" | "success" | "error">("saving");
  const [errorMsg, setErrorMsg] = useState("");
  const [debugInfo, setDebugInfo] = useState("");

  useEffect(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(
        window.location.hash.startsWith("#")
          ? window.location.hash.slice(1)
          : window.location.hash,
      );

      const stateData = decodeState(params.get("state") || hashParams.get("state"));
      const pending = readPendingConnection();

      let connectionId =
        params.get("id") ||
        params.get("connection_id") ||
        params.get("connectionId") ||
        hashParams.get("id") ||
        hashParams.get("connection_id") ||
        hashParams.get("connectionId");

      const category =
        params.get("category") ||
        hashParams.get("category") ||
        stateData?.category ||
        pending?.category ||
        "";

      const integrationType =
        params.get("integration_type") ||
        hashParams.get("integration_type") ||
        stateData?.integration_type ||
        pending?.integration_type ||
        "";

      const tenantId =
        params.get("tenant_id") ||
        hashParams.get("tenant_id") ||
        stateData?.tenant_id ||
        pending?.tenant_id ||
        "";

      const flowUid =
        params.get("uid") ||
        params.get("external_xref") ||
        hashParams.get("uid") ||
        hashParams.get("external_xref") ||
        stateData?.flow_uid ||
        pending?.flow_uid ||
        "";

      try {
        if (!connectionId && flowUid && tenantId) {
          const { data, error } = await supabase.functions.invoke("unified-connections", {
            body: {
              action: "find_connection",
              tenant_id: tenantId,
              integration_type: integrationType,
              uid: flowUid,
            },
          });

          if (error) throw error;
          connectionId = data?.connection_id ?? null;
        }

        if (!connectionId || !tenantId) {
          setDebugInfo(
            [
              `URL: ${window.location.href}`,
              `Params: ${JSON.stringify(Object.fromEntries(params.entries()))}`,
              `Hash: ${window.location.hash}`,
              `Flow UID: ${flowUid || "missing"}`,
              `connectionId=${connectionId}`,
              `tenantId=${tenantId}`,
            ].join("\n"),
          );
          setStatus("error");
          setErrorMsg("Missing connection ID or tenant ID");
          return;
        }

        const { error } = await supabase.functions.invoke("unified-connections", {
          body: {
            action: "save_connection",
            tenant_id: tenantId,
            connection_id: connectionId,
            category,
            integration_type: integrationType,
          },
        });

        if (error) throw error;

        setStatus("success");
        sessionStorage.removeItem("unified_pending_connection");

        if (window.opener) {
          window.opener.postMessage({ type: "unified-connected" }, "*");
          try {
            window.opener.sessionStorage.removeItem("unified_pending_connection");
          } catch {
            // noop
          }
        }

        setTimeout(() => window.close(), 2000);
      } catch (err: any) {
        setDebugInfo(
          [
            `URL: ${window.location.href}`,
            `Params: ${JSON.stringify(Object.fromEntries(params.entries()))}`,
            `Hash: ${window.location.hash}`,
            `Flow UID: ${flowUid || "missing"}`,
          ].join("\n"),
        );
        setStatus("error");
        setErrorMsg(err?.message || "Unknown error");
      }
    };

    void run();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background" dir="rtl">
      <div className="text-center space-y-4 p-8">
        {status === "saving" && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-lg font-medium">שומר את החיבור...</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <p className="text-lg font-medium text-primary">החיבור נשמר בהצלחה!</p>
            <p className="text-sm text-muted-foreground">החלון ייסגר אוטומטית...</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <p className="text-lg font-medium text-destructive">שגיאה בשמירת החיבור</p>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            {debugInfo && (
              <pre className="text-xs text-left bg-muted text-foreground p-3 rounded mt-4 max-w-lg mx-auto overflow-auto whitespace-pre-wrap" dir="ltr">
                {debugInfo}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  );
}
