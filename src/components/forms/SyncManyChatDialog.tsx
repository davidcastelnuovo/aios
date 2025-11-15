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
  total: number;
  clientsMatched: number;
  leadsMatched: number;
  notMatched: number;
}

export function SyncManyChatDialog() {
  const [open, setOpen] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const { tenantId } = useCurrentTenant();

  // Count clients without ManyChat ID
  const { data: unsyncedCount } = useQuery({
    queryKey: ['unsynced-clients', tenantId],
    queryFn: async () => {
      const { count } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .is('manychat_subscriber_id', null);
      return count || 0;
    },
    enabled: !!tenantId,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('sync-manychat-subscribers', {
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
          סנכרן לקוחות מ-ManyChat
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>סנכרון לקוחות מ-ManyChat</DialogTitle>
          <DialogDescription>
            הסנכרון יבדוק התאמות לפי מספר טלפון בלבד. לא ייווצרו לקוחות חדשים.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {unsyncedCount !== undefined && unsyncedCount > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-1">
                  {unsyncedCount} לקוחות ללא חיבור ManyChat
                </div>
                <div className="text-sm">
                  לקוחות אלה לא מסונכרנים עם ManyChat. הסנכרון ינסה למצוא אותם לפי מספר טלפון.
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              המערכת תחפש התאמות קיימות:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>תחילה בלקוחות הפעילים</li>
                <li>לאחר מכן בלידים</li>
                <li>לא יתווספו לקוחות חדשים</li>
              </ul>
            </AlertDescription>
          </Alert>

          {syncResult && (
            <div className="space-y-3 p-4 rounded-lg bg-muted">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-semibold">תוצאות סנכרון</span>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">סך הכל subscribers:</span>
                  <span className="font-medium">{syncResult.total}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    לקוחות שסונכרנו:
                  </span>
                  <span className="font-medium text-green-600">{syncResult.clientsMatched}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <UserPlus className="h-3 w-3" />
                    לידים שנמצאו:
                  </span>
                  <span className="font-medium text-blue-600">{syncResult.leadsMatched}</span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ללא התאמה:</span>
                  <span className="font-medium text-muted-foreground">{syncResult.notMatched}</span>
                </div>
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
                  מסנכרן...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 ml-2" />
                  התחל סנכרון
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
