import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Copy, ExternalLink, CheckCircle, CreditCard } from 'lucide-react';

interface CreatePaymentLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    retainer?: number;
  } | null;
}

export const CreatePaymentLinkDialog: React.FC<CreatePaymentLinkDialogProps> = ({
  open,
  onOpenChange,
  client
}) => {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<string>(client?.retainer?.toString() || '');
  const [description, setDescription] = useState<string>('');
  const [sendEmail, setSendEmail] = useState<boolean>(true);
  const [expirationDays, setExpirationDays] = useState<string>('30');
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset form when client changes
  React.useEffect(() => {
    if (client) {
      setAmount(client.retainer?.toString() || '');
      setDescription(`תשלום עבור שירותים - ${client.name}`);
      setPaymentUrl(null);
      setCopied(false);
    }
  }, [client]);

  const createPaymentLink = useMutation({
    mutationFn: async () => {
      if (!client) throw new Error('No client selected');
      if (!amount || parseFloat(amount) <= 0) throw new Error('Invalid amount');

      const { data, error } = await supabase.functions.invoke('create-sumit-payment', {
        body: {
          clientId: client.id,
          amount: parseFloat(amount),
          description: description || `תשלום עבור שירותים - ${client.name}`,
          sendEmail: sendEmail,
          expirationDays: parseInt(expirationDays)
        }
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      setPaymentUrl(data.paymentUrl);
      queryClient.invalidateQueries({ queryKey: ['payment-links'] });
      
      if (data.emailSent) {
        toast.success('קישור התשלום נוצר ונשלח ללקוח במייל!');
      } else {
        toast.success('קישור התשלום נוצר בהצלחה!');
      }
    },
    onError: (error: Error) => {
      console.error('Error creating payment link:', error);
      toast.error(error.message || 'שגיאה ביצירת קישור התשלום');
    }
  });

  const handleCopyLink = async () => {
    if (paymentUrl) {
      await navigator.clipboard.writeText(paymentUrl);
      setCopied(true);
      toast.success('הקישור הועתק!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setPaymentUrl(null);
    setCopied(false);
    onOpenChange(false);
  };

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            יצירת קישור תשלום
          </DialogTitle>
          <DialogDescription>
            יצירת קישור תשלום עבור: <strong>{client.name}</strong>
          </DialogDescription>
        </DialogHeader>

        {paymentUrl ? (
          // Success state - show payment link
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">הקישור נוצר בהצלחה!</p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  סכום: ₪{parseFloat(amount).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>קישור לתשלום</Label>
              <div className="flex gap-2">
                <Input
                  value={paymentUrl}
                  readOnly
                  className="text-sm"
                  dir="ltr"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                >
                  {copied ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(paymentUrl, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          // Form state
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">סכום לתשלום (₪)</Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="1"
                step="0.01"
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">תיאור</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="תיאור התשלום..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiration">תוקף הקישור</Label>
              <Select value={expirationDays} onValueChange={setExpirationDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 ימים</SelectItem>
                  <SelectItem value="14">14 ימים</SelectItem>
                  <SelectItem value="30">30 ימים</SelectItem>
                  <SelectItem value="60">60 ימים</SelectItem>
                  <SelectItem value="90">90 ימים</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="sendEmail"
                checked={sendEmail}
                onCheckedChange={(checked) => setSendEmail(checked === true)}
                disabled={!client.email}
              />
              <Label htmlFor="sendEmail" className="text-sm cursor-pointer">
                שלח מייל ללקוח אוטומטית
                {!client.email && <span className="text-muted-foreground mr-1">(אין מייל)</span>}
              </Label>
            </div>

            {client.email && sendEmail && (
              <p className="text-sm text-muted-foreground">
                המייל יישלח ל: {client.email}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            {paymentUrl ? 'סגור' : 'ביטול'}
          </Button>
          {!paymentUrl && (
            <Button
              onClick={() => createPaymentLink.mutate()}
              disabled={createPaymentLink.isPending || !amount || parseFloat(amount) <= 0}
            >
              {createPaymentLink.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  יוצר קישור...
                </>
              ) : (
                'יצור קישור תשלום'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};