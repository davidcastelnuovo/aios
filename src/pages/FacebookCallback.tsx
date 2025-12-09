import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FacebookCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const { tenant: currentTenant } = useCurrentTenant();
  
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('מעבד את החיבור לפייסבוק...');

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');

      if (error) {
        setStatus('error');
        setMessage(errorDescription || 'שגיאה בהתחברות לפייסבוק');
        return;
      }

      if (!code || !state) {
        setStatus('error');
        setMessage('חסרים פרטי התחברות');
        return;
      }

      try {
        const redirectUri = `${window.location.origin}/t/${currentTenant?.slug}/facebook-callback`;

        const { data, error: fnError } = await supabase.functions.invoke('facebook-auth?action=callback', {
          body: {
            code,
            state,
            redirect_uri: redirectUri,
          },
        });

        if (fnError) throw fnError;

        if (data?.success) {
          setStatus('success');
          setMessage(`החיבור הצליח! נמצאו ${data.pages?.length || 0} עמודים`);
        } else {
          throw new Error(data?.error || 'Unknown error');
        }
      } catch (err) {
        console.error('Facebook callback error:', err);
        setStatus('error');
        setMessage((err as Error).message || 'שגיאה בעיבוד החיבור');
      }
    };

    processCallback();
  }, [searchParams, currentTenant?.slug]);

  return (
    <div className="container mx-auto p-6 flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {status === 'processing' && 'מתחבר לפייסבוק...'}
            {status === 'success' && 'החיבור הצליח!'}
            {status === 'error' && 'שגיאה בחיבור'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === 'processing' && (
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          )}
          {status === 'success' && (
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500" />
          )}
          {status === 'error' && (
            <XCircle className="h-12 w-12 mx-auto text-destructive" />
          )}
          
          <p className="text-muted-foreground">{message}</p>

          {status !== 'processing' && (
            <Button onClick={() => navigate(buildPath('/facebook-settings'))}>
              חזור להגדרות Facebook
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
