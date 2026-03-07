import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Mail, Loader2, ArrowRight, Unplug } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useTenantPath } from "@/hooks/useTenantPath";

export default function GmailSettings() {
  const { tenantId } = useCurrentTenant();
  const { userId } = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();

  // Connection status
  const { data: connectionStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['gmail-status', userId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('gmail-auth', {
        body: { action: 'status' },
      });
      if (error) throw error;
      return data as { connected: boolean; google_email: string | null };
    },
    enabled: !!userId,
  });

  // Categories
  const { data: categories = [] } = useQuery({
    queryKey: ['gmail-categories', tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gmail_categories')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  // Blocked senders
  const { data: blockedSenders = [] } = useQuery({
    queryKey: ['gmail-blocked-senders', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('gmail_blocked_senders')
        .select('*')
        .eq('user_id', userId!)
        .order('blocked_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  // Connect Gmail
  const connectGmail = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('gmail-auth', {
        body: { action: 'init', tenantId },
      });
      if (error) throw error;
      if (data?.authUrl) {
        window.open(data.authUrl, 'gmail-auth', 'width=600,height=700');
      }
    } catch (e) {
      toast.error('שגיאה בחיבור Gmail');
    }
  };

  // Listen for OAuth callback
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'gmail_connected') {
        queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
        toast.success('Gmail התחבר בהצלחה!');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [queryClient]);

  // Disconnect
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke('gmail-auth', {
        body: { action: 'disconnect' },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail-status'] });
      toast.success('Gmail נותק בהצלחה');
    },
  });

  // Add category
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('#3B82F6');
  const addCategory = useMutation({
    mutationFn: async () => {
      if (!newCategoryName.trim()) throw new Error('שם קטגוריה נדרש');
      const { error } = await supabase.from('gmail_categories').insert({
        tenant_id: tenantId!,
        name: newCategoryName.trim(),
        color: newCategoryColor,
        sort_order: categories.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewCategoryName('');
      queryClient.invalidateQueries({ queryKey: ['gmail-categories'] });
      toast.success('קטגוריה נוספה');
    },
    onError: () => toast.error('שגיאה בהוספת קטגוריה'),
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('gmail_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail-categories'] });
      toast.success('קטגוריה נמחקה');
    },
  });

  // Add blocked sender
  const [newBlockedEmail, setNewBlockedEmail] = useState('');
  const addBlockedSender = useMutation({
    mutationFn: async () => {
      if (!newBlockedEmail.trim()) throw new Error('כתובת מייל נדרשת');
      const { error } = await supabase.from('gmail_blocked_senders').insert({
        tenant_id: tenantId!,
        user_id: userId!,
        email_address: newBlockedEmail.trim().toLowerCase(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewBlockedEmail('');
      queryClient.invalidateQueries({ queryKey: ['gmail-blocked-senders'] });
      toast.success('כתובת נחסמה');
    },
    onError: (e: any) => {
      if (e?.message?.includes('duplicate')) toast.error('הכתובת כבר חסומה');
      else toast.error('שגיאה בחסימת כתובת');
    },
  });

  const removeBlockedSender = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('gmail_blocked_senders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gmail-blocked-senders'] });
      toast.success('החסימה הוסרה');
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Mail className="h-8 w-8" />
            הגדרות Gmail
          </h1>
          <p className="text-muted-foreground mt-1">חבר את חשבון הגוגל שלך לשליחה, קבלה וארגון מיילים</p>
        </div>
        {connectionStatus?.connected && (
          <Button onClick={() => navigate(buildPath('gmail'))} className="gap-2">
            פתח תיבת דואר
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Connection */}
      <Card>
        <CardHeader>
          <CardTitle>חיבור חשבון Google</CardTitle>
          <CardDescription>חבר את חשבון הגוגל שלך כדי לגשת לתיבת הדואר</CardDescription>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="animate-spin h-4 w-4" /> בודק חיבור...</div>
          ) : connectionStatus?.connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className="bg-green-500/90 hover:bg-green-500">✓ מחובר</Badge>
                <span className="text-sm text-muted-foreground">{connectionStatus.google_email}</span>
              </div>
              <Button variant="destructive" size="sm" onClick={() => disconnectMutation.mutate()} disabled={disconnectMutation.isPending}>
                <Unplug className="h-4 w-4 ml-2" />
                נתק
              </Button>
            </div>
          ) : (
            <Button onClick={connectGmail}>
              <Mail className="h-4 w-4 ml-2" />
              חבר חשבון Gmail
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle>קטגוריות מייל</CardTitle>
          <CardDescription>צור קטגוריות לארגון המיילים שלך</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="שם קטגוריה..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCategory.mutate()}
            />
            <input
              type="color"
              value={newCategoryColor}
              onChange={(e) => setNewCategoryColor(e.target.value)}
              className="w-10 h-10 rounded border cursor-pointer"
            />
            <Button onClick={() => addCategory.mutate()} disabled={addCategory.isPending} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין קטגוריות עדיין</p>
          ) : (
            <div className="space-y-2">
              {categories.map((cat: any) => (
                <div key={cat.id} className="flex items-center justify-between p-2 rounded border">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-sm">{cat.name}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteCategory.mutate(cat.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Blocked Senders */}
      <Card>
        <CardHeader>
          <CardTitle>כתובות חסומות</CardTitle>
          <CardDescription>מיילים מכתובות אלו לא יופיעו בתיבת הדואר</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="כתובת מייל לחסימה..."
              type="email"
              value={newBlockedEmail}
              onChange={(e) => setNewBlockedEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addBlockedSender.mutate()}
            />
            <Button onClick={() => addBlockedSender.mutate()} disabled={addBlockedSender.isPending} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {blockedSenders.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין כתובות חסומות</p>
          ) : (
            <div className="space-y-2">
              {blockedSenders.map((bs: any) => (
                <div key={bs.id} className="flex items-center justify-between p-2 rounded border">
                  <span className="text-sm" dir="ltr">{bs.email_address}</span>
                  <Button variant="ghost" size="icon" onClick={() => removeBlockedSender.mutate(bs.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
