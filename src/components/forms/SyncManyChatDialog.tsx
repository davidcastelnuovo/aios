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
  matched_clients: number;
  matched_leads: number;
  unmatched: number;
}

export function SyncManyChatDialog() {
  const [open, setOpen] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const { tenantId } = useCurrentTenant();

  // Count unique ManyChat contacts in chat messages
  const { data: manychatContactsCount } = useQuery({
    queryKey: ['manychat-contacts', tenantId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('chat_messages')
        .select('client_id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .not('raw_provider_data', 'is', null);
      
      if (error) throw error;
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
          סנכרן מ-ManyChat
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>סנכרון עם ManyChat</DialogTitle>
          <DialogDescription>
            מתאים לקוחות ולידים עם מנויי ManyChat לפי הודעות שנשלחו.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {manychatContactsCount !== undefined && manychatContactsCount > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-1">
                  {manychatContactsCount} הודעות ManyChat במערכת
                </div>
                <div className="text-sm">
                  הסנכרון יתאים לקוחות/לידים למנויי ManyChat שכבר שלחו הודעות.
                </div>
              </AlertDescription>
            </Alert>
          )}

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <div className="font-semibold mb-2">איך זה עובד:</div>
              <ul className="list-disc list-inside space-y-1">
                <li>בודק הודעות ManyChat שנשמרו במערכת</li>
                <li>מתאים ללקוחות/לידים לפי מספר טלפון</li>
                <li>עדכון subscriber_id - ללא כפילויות</li>
                <li className="text-amber-600">רק מי ששלח הודעה דרך ManyChat יסונכרן</li>
              </ul>
            </AlertDescription>
          </Alert>

          {syncResult && (
            <Alert>
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="space-y-2">
                <div className="font-semibold">הסנכרון הושלם בהצלחה</div>
                <div className="text-sm space-y-1">
                  <div>• סה"כ הודעות: {syncResult.total}</div>
                  <div className="text-green-600">✓ לקוחות: {syncResult.matched_clients}</div>
                  <div className="text-green-600">✓ לידים: {syncResult.matched_leads}</div>
                  {syncResult.unmatched > 0 && (
                    <div className="text-amber-600">ללא התאמה: {syncResult.unmatched}</div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
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
