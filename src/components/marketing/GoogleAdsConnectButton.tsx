/**
 * GoogleAdsConnectButton
 * Shown inside CampaignLauncher when no Google Ads account is connected.
 * Initiates the OAuth flow via the existing google-ads-auth edge function.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Globe,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";

interface ConnectionStatus {
  connected: boolean;
  accounts?: { customer_id: string; name: string }[];
  email?: string;
  error?: string;
}

interface Props {
  tenantId: string;
  onConnected?: (accounts: { customer_id: string; name: string }[]) => void;
}

export function GoogleAdsConnectButton({ tenantId, onConnected }: Props) {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-ads-auth", {
        body: { action: "check_status" },
      });
      if (error) throw error;
      setStatus(data);
      if (data?.connected && data?.accounts) {
        onConnected?.(data.accounts);
      }
    } catch (e: any) {
      setStatus({ connected: false, error: e.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkStatus();

    // Listen for OAuth callback via postMessage (popup window)
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "google_ads_oauth_success") {
        setConnecting(false);
        toast.success("Google Ads חובר בהצלחה!");
        checkStatus();
      } else if (event.data?.type === "google_ads_oauth_error") {
        setConnecting(false);
        toast.error(`שגיאה בחיבור: ${event.data.error}`);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const startOAuth = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-ads-auth", {
        body: { action: "get_auth_url", origin: window.location.origin },
      });
      if (error) throw error;
      if (!data?.auth_url) throw new Error("לא התקבל URL לאימות");

      // Open OAuth in a popup
      const popup = window.open(
        data.auth_url,
        "google_ads_oauth",
        "width=500,height=650,scrollbars=yes,resizable=yes"
      );

      if (!popup) {
        toast.error("הדפדפן חסם את החלון הקופץ. אפשר חלונות קופצים ונסה שוב.");
        setConnecting(false);
      }
    } catch (e: any) {
      toast.error(`שגיאה: ${e.message}`);
      setConnecting(false);
    }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      const { error } = await supabase.functions.invoke("google-ads-auth", {
        body: { action: "disconnect" },
      });
      if (error) throw error;
      toast.success("Google Ads נותק");
      setStatus({ connected: false });
    } catch (e: any) {
      toast.error(`שגיאה: ${e.message}`);
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        בודק חיבור Google Ads...
      </div>
    );
  }

  if (status?.connected) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 space-y-2" dir="rtl">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="text-sm font-medium text-emerald-800">Google Ads מחובר</span>
          {status.email && (
            <span className="text-xs text-emerald-600 ms-auto">{status.email}</span>
          )}
        </div>
        {status.accounts && status.accounts.length > 0 && (
          <div className="space-y-1">
            {status.accounts.map((acc) => (
              <div key={acc.customer_id} className="flex items-center gap-2 rounded bg-white border border-emerald-200 px-2 py-1">
                <Globe className="h-3 w-3 text-emerald-500" />
                <span className="text-xs font-medium">{acc.name}</span>
                <Badge variant="outline" className="ms-auto text-[9px] border-emerald-300 text-emerald-600">
                  {acc.customer_id}
                </Badge>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-muted-foreground hover:text-gray-700"
            onClick={checkStatus}
          >
            <RefreshCw className="ml-1 h-3 w-3" /> רענן
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50"
            onClick={disconnect}
            disabled={disconnecting}
          >
            {disconnecting ? (
              <Loader2 className="ml-1 h-3 w-3 animate-spin" />
            ) : (
              <Unlink className="ml-1 h-3 w-3" />
            )}
            נתק
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4 text-center space-y-3" dir="rtl">
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        Google Ads לא מחובר
      </div>
      <p className="text-xs text-muted-foreground">
        חבר את חשבון Google Ads שלך כדי להשיק קמפיינים ישירות מהמערכת
      </p>
      <Button
        onClick={startOAuth}
        disabled={connecting}
        className="bg-blue-600 hover:bg-blue-700 text-white"
        size="sm"
      >
        {connecting ? (
          <><Loader2 className="ml-2 h-4 w-4 animate-spin" />מתחבר...</>
        ) : (
          <><Globe className="ml-2 h-4 w-4" />חבר Google Ads</>
        )}
      </Button>
      {status?.error && (
        <p className="text-xs text-red-500">{status.error}</p>
      )}
    </div>
  );
}
