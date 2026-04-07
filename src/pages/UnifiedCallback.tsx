import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function UnifiedCallback() {
  const [status, setStatus] = useState<"saving" | "success" | "error">("saving");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let connectionId = params.get("id");
    let category = params.get("category");
    let integrationType = params.get("integration_type");
    let tenantId = params.get("tenant_id");

    // Fallback to sessionStorage if URL params were stripped by Unified.to
    const stored = sessionStorage.getItem("unified_pending_connection");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (!category) category = parsed.category;
        if (!integrationType) integrationType = parsed.integration_type;
        if (!tenantId) tenantId = parsed.tenant_id;
      } catch {}
    }

    if (!connectionId || !tenantId) {
      setStatus("error");
      setErrorMsg("Missing connection ID or tenant ID. connectionId=" + connectionId + " tenantId=" + tenantId);
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

        // Notify parent window
        if (window.opener) {
          window.opener.postMessage({ type: "unified-connected" }, "*");
        }

        // Auto-close after 2 seconds
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
          </>
        )}
      </div>
    </div>
  );
}
