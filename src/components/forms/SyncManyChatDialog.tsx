import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RefreshCw, CheckCircle, Users, UserPlus, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface SyncResult {
  success: boolean;
  total_subscribers: number;
  total_clients: number;
  total_leads: number;
  clients_matched: number;
  leads_matched: number;
  clients_unmatched: number;
  leads_unmatched: number;
}

export function SyncManyChatDialog() {
  const [open, setOpen] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const { tenantId } = useCurrentTenant();

  // Count clients and leads without ManyChat ID
  const { data: unsyncedCount } = useQuery({
    queryKey: ['unsynced-counts', tenantId],
    queryFn: async () => {
      const [clientsResult, leadsResult] = await Promise.all([
        supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .is('manychat_subscriber_id', null),
        supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .is('manychat_subscriber_id', null)
      ]);
      
      return {
        clients: clientsResult.count || 0,
        leads: leadsResult.count || 0,
        total: (clientsResult.count || 0) + (leadsResult.count || 0)
      };
    },
    enabled: !!tenantId,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('import-manychat-subscribers', {
        body: { tenantId }
      });
      
      if (error) throw error;
      return data as SyncResult;
    },
    onSuccess: (data) => {
      setSyncResult(data);
      toast.success('הסנכרון הושלם בהצלחה');
    },
    onError: (error: any) => {
      console.error('Sync error:', error);
      toast.error('שגיאה בסנכרון עם ManyChat');
    },
  });

  const handleSync = () => {
    setSyncResult(null);
    syncMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <RefreshCw className="h-4 w-4 ml-2" />
          ייבוא מנויים מ-ManyChat
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>ייבוא מנויים מ-ManyChat API</DialogTitle>
          <DialogDescription>
            הפונקציה תמשוך את כל המנויים מ-ManyChat ותתאים אותם ללקוחות ולידים קיימים לפי מספר טלפון.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {unsyncedCount && unsyncedCount.total > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-1">
                  {unsyncedCount.total} רשומות ללא חיבור ManyChat
                </div>
                <div className="text-sm space-y-1">
                  <div>• {unsyncedCount.clients} לקוחות</div>
                  <div>• {unsyncedCount.leads} לידים</div>
                  <div className="mt-2">הייבוא ינסה למצוא אותם לפי מספר טלפון.</div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <div className="font-semibold mb-2">תהליך הייבוא:</div>
              <ul className="list-disc list-inside space-y-1">
                <li>משיכת כל המנויים מ-ManyChat API</li>
                <li>התאמה ללקוחות ולידים לפי מספר טלפון</li>
                <li>עדכון subscriber_id בלבד - ללא כפילויות</li>
                <li>רק רשומות בסוכנויות שיש לך גישה אליהן</li>
              </ul>
            </AlertDescription>
          </Alert>

          {syncResult && (
            <div className="space-y-3 p-4 rounded-lg bg-muted">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-semibold">הסנכרון הושלם</span>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">מנויים ב-ManyChat:</span>
                  <span className="font-semibold">{syncResult.total_subscribers}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">סה"כ לקוחות במערכת:</span>
                  <span className="font-semibold">{syncResult.total_clients}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">סה"כ לידים במערכת:</span>
                  <span className="font-semibold">{syncResult.total_leads}</span>
                </div>
                
                <div className="h-px bg-border my-2" />
                
                <div className="flex items-center justify-between text-green-600">
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    לקוחות שסונכרנו:
                  </span>
                  <span className="font-semibold">{syncResult.clients_matched}</span>
                </div>
                
                <div className="flex items-center justify-between text-green-600">
                  <span className="flex items-center gap-1">
                    <UserPlus className="h-4 w-4" />
                    לידים שסונכרנו:
                  </span>
                  <span className="font-semibold">{syncResult.leads_matched}</span>
                </div>
                
                {(syncResult.clients_unmatched > 0 || syncResult.leads_unmatched > 0) && (
                  <>
                    <div className="h-px bg-border my-2" />
                    
                    {syncResult.clients_unmatched > 0 && (
                      <div className="flex items-center justify-between text-amber-600">
                        <span>לקוחות ללא התאמה:</span>
                        <span className="font-semibold">{syncResult.clients_unmatched}</span>
                      </div>
                    )}
                    
                    {syncResult.leads_unmatched > 0 && (
                      <div className="flex items-center justify-between text-amber-600">
                        <span>לידים ללא התאמה:</span>
                        <span className="font-semibold">{syncResult.leads_unmatched}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleSync}
              disabled={syncMutation.isPending}
              className="flex-1"
            >
              {syncMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 ml-2 animate-spin" />
                  מייבא מנויים...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 ml-2" />
                  התחל ייבוא
                </>
              )}
            </Button>
            
            {syncResult && (
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
              >
                סגור
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
