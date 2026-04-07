import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function UnifiedCallback() {
  const [status, setStatus] = useState<"saving" | "success" | "error">("saving");
  const [errorMsg, setErrorMsg] = useState("");
  const [debugInfo, setDebugInfo] = useState("");

  useEffect(() => {
    // Collect all possible sources of params
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace("#", "?"));
    
    // Try multiple param names that Unified.to might use
    let connectionId = params.get("id") || params.get("connection_id") || params.get("connectionId")
      || hashParams.get("id") || hashParams.get("connection_id") || hashParams.get("connectionId");
    
    let category = params.get("category");
    let integrationType = params.get("integration_type");
    let tenantId = params.get("tenant_id");

    // Debug: log full URL for troubleshooting
    const fullUrl = window.location.href;
    console.log("[UnifiedCallback] Full URL:", fullUrl);
    console.log("[UnifiedCallback] Search params:", window.location.search);
    console.log("[UnifiedCallback] Hash:", window.location.hash);
    console.log("[UnifiedCallback] All params:", Object.fromEntries(params.entries()));

    // Fallback to sessionStorage (works in same-origin popups)
    const stored = sessionStorage.getItem("unified_pending_connection");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (!category) category = parsed.category;
        if (!integrationType) integrationType = parsed.integration_type;
        if (!tenantId) tenantId = parsed.tenant_id;
      } catch {}
    }

    // Also try opener's sessionStorage if available
    if ((!tenantId || !category) && window.opener) {
      try {
        const openerStored = window.opener.sessionStorage.getItem("unified_pending_connection");
        if (openerStored) {
          const parsed = JSON.parse(openerStored);
          if (!category) category = parsed.category;
          if (!integrationType) integrationType = parsed.integration_type;
          if (!tenantId) tenantId = parsed.tenant_id;
        }
      } catch (e) {
        console.log("[UnifiedCallback] Cannot access opener sessionStorage:", e);
      }
    }

    if (!connectionId || !tenantId) {
      const debug = `URL: ${fullUrl}\nParams: ${JSON.stringify(Object.fromEntries(params.entries()))}\nHash: ${window.location.hash}\nconnectionId=${connectionId}\ntenantId=${tenantId}`;
      setDebugInfo(debug);
      setStatus("error");
      setErrorMsg("Missing connection ID or tenant ID");
      return;
    }

    const saveConnection = async () => {
      try {
        const { error } = await supabase.functions.invoke("unified-connections", {
          body: {
            action: "save_connection",
            tenant_id: tenantId,
            connection_id: connectionId,
            category: category || "",
            integration_type: integrationType || "",
          },
        });
        if (error) throw error;

        setStatus("success");
        sessionStorage.removeItem("unified_pending_connection");

        // Notify parent window
        if (window.opener) {
          window.opener.postMessage({ type: "unified-connected" }, "*");
          try { window.opener.sessionStorage.removeItem("unified_pending_connection"); } catch {}
        }

        setTimeout(() => window.close(), 2000);
      } catch (err: any) {
        setStatus("error");
        setErrorMsg(err.message || "Unknown error");
      }
    };

    saveConnection();
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
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <p className="text-lg font-medium text-green-600">החיבור נשמר בהצלחה!</p>
            <p className="text-sm text-muted-foreground">החלון ייסגר אוטומטית...</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <p className="text-lg font-medium text-destructive">שגיאה בשמירת החיבור</p>
            <p className="text-sm text-muted-foreground">{errorMsg}</p>
            {debugInfo && (
              <pre className="text-xs text-left bg-muted p-3 rounded mt-4 max-w-lg mx-auto overflow-auto whitespace-pre-wrap" dir="ltr">
                {debugInfo}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  );
}