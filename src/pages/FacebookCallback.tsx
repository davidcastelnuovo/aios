import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FacebookCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('מעבד את החיבור לפייסבוק...');

  useEffect(() => {
    // Check for success/error params from Edge Function redirect
    const success = searchParams.get('facebook_success');
    const pagesCount = searchParams.get('pages_count');
    const error = searchParams.get('facebook_error');

    if (success === 'true') {
      setStatus('success');
      setMessage(`החיבור הצליח! נמצאו ${pagesCount || 0} עמודים`);
    } else if (error) {
      setStatus('error');
      setMessage(decodeURIComponent(error));
    } else {
      // No params - redirect to settings
      navigate(buildPath('/facebook-settings'));
    }
  }, [searchParams, navigate, buildPath]);

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
