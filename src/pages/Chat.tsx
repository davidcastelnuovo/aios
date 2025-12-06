import { useState, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useUserAgencies } from "@/hooks/useUserAgencies";
import { useAgency } from "@/contexts/AgencyContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MessageCircle, Search, Settings, Pencil, Trash2, Check } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import ChatView from "@/components/chat/ChatView";
import { EditClientDialog } from "@/components/forms/EditClientDialog";
import { EditLeadDialog } from "@/components/forms/EditLeadDialog";

interface Contact {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  agency_id: string | null;
  agency_name: string | null;
  manychat_subscriber_id: string | null;
  active_chat_provider: string | null;
  unread_count: number;
  contact_type: 'client' | 'lead' | 'group' | 'unknown';
  last_message_at: string | null;
  sender_phone?: string;
  is_blocked?: boolean;
  has_messages?: boolean;
}

const normalizePhone = (phone?: string | null) => {
  if (!phone) return '';
  const digits = (phone.match(/\d+/g) || []).join('');
  let p = digits.replace(/^00/, '');
  if (p.startsWith('972')) p = p.slice(3);
  if (p.startsWith('0')) p = p.slice(1);
  return p.slice(-9);
};

export default function Chat() {
  const { clientId } = useParams();
  const { tenantId } = useCurrentTenant();
  const { buildPath } = useTenantPath();
  const { userAgencyIds, isLoading: agenciesLoading } = useUserAgencies();
  const { selectedAgency } = useAgency();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const [contactFilter, setContactFilter] = useState<"all" | "clients" | "leads" | "groups" | "unknown">("all");
  const [showTodayOnly, setShowTodayOnly] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [selectedContact, setSelectedContact] = useState<{ id: string; type: 'client' | 'lead' | 'group' | 'unknown'; senderPhone?: string } | null>(
    clientId ? { id: clientId, type: 'client' } : null
  );
  const [editingContact, setEditingContact] = useState<{ id: string; type: 'client' | 'lead'; data: any } | null>(null);
  const [showClearHistoryDialog, setShowClearHistoryDialog] = useState(false);

  // Fetch active chats (default mode - no search)
  const { data: activeChats, isLoading: activeChatsLoading } = useQuery({
    queryKey: ['active-chats', tenantId, userAgencyIds, selectedAgency],
    queryFn: async () => {
      if (!tenantId) {
        console.log('❌ No tenantId - skipping fetch');
        return [];
      }

      console.log('🚀 Fetching active chats for tenant:', tenantId);
      console.log('👥 User agencies:', userAgencyIds);
      console.log('🏢 Selected agency:', selectedAgency);

      const { data, error } = await supabase.rpc('get_chat_contacts', { p_tenant_id: tenantId });

      if (error) {
        console.error('❌ Error fetching active chats:', error);
        throw error;
      }

      console.log('📥 Received contacts from RPC:', data?.length || 0);
      
      const mapped = (data || []).map((contact: any) => ({
        id: contact.contact_id,
        name: contact.name,
        contact_name: contact.contact_name,
        phone: contact.phone,
        email: contact.email,
        agency_id: contact.agency_id,
        agency_name: contact.agency_name,
        manychat_subscriber_id: contact.manychat_subscriber_id,
        active_chat_provider: contact.active_chat_provider,
        contact_type: contact.contact_type,
        unread_count: contact.unread_count || 0,
        last_message_at: contact.last_message_at,
        sender_phone: contact.sender_phone,
        is_blocked: contact.is_blocked || false,
        has_messages: true,
      }));

      console.log('✅ Mapped contacts:', mapped.length);
      return mapped;
    },
    enabled: !!tenantId && !agenciesLoading && !debouncedSearch,
    refetchInterval: 30000,
  });

  // Search contacts (search mode - includes contacts without messages)
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['search-contacts', tenantId, debouncedSearch],
    queryFn: async () => {
      if (!tenantId || !debouncedSearch) {
        return [];
      }

      const { data, error } = await supabase.rpc('search_contacts_for_chat', {
        p_search_term: debouncedSearch,
        p_tenant_id: tenantId,
      });

      if (error) {
        console.error('Error searching contacts:', error);
        throw error;
      }

      return (data || []).map((contact: any) => ({
        id: contact.contact_id,
        name: contact.name,
        contact_name: contact.contact_name,
        phone: contact.phone,
        email: contact.email,
        agency_id: contact.agency_id,
        agency_name: contact.agency_name,
        manychat_subscriber_id: contact.manychat_subscriber_id,
        active_chat_provider: contact.active_chat_provider,
        contact_type: contact.contact_type,
        unread_count: contact.unread_count || 0,
        last_message_at: contact.last_message_at,
        sender_phone: contact.phone,
        is_blocked: contact.is_blocked || false,
        has_messages: contact.has_messages || false,
      }));
    },
    enabled: !!tenantId && !!debouncedSearch,
  });

  // Use appropriate data source
  const contacts = debouncedSearch ? searchResults : activeChats;
  const isLoading = debouncedSearch ? searchLoading : activeChatsLoading;

  // Fetch unknown contacts using the database function
  const { data: unknownContacts = [] } = useQuery({
    queryKey: ['unknown-contacts', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      console.log('🔍 Fetching unknown contacts via RPC');
      const { data, error } = await supabase.rpc('get_unknown_chat_contacts');

      if (error) {
        console.error('❌ Error fetching unknown contacts:', error);
        return [];
      }

      console.log('📥 Received unknown contacts from RPC:', data?.length || 0);

      // Map the data from the RPC function
      return (data || []).map((contact: any) => ({
        id: contact.id,
        name: contact.name,
        sender_phone: contact.sender_phone,
        active_chat_provider: 'green_api',
        last_message_at: contact.last_message_at,
        unread_count: contact.unread_count || 0,
        is_blocked: contact.is_blocked || false,
        contact_type: contact.contact_type as 'unknown',
        agency_id: contact.agency_id,
        agency_name: contact.agency_name,
      }));
    },
    enabled: !!tenantId && !debouncedSearch,
  });

  // Get all contacts before contact type filtering (for counts)
  const allContactsBeforeTypeFilter = useMemo(() => {
    let base = contacts || [];
    
    // Add unknown contacts in active chats mode (only if not searching)
    if (!debouncedSearch && unknownContacts && unknownContacts.length > 0) {
      const normalizedUnknown = unknownContacts.map(uc => ({
        id: `unknown-${uc.sender_phone || uc.id}`,
        name: uc.name,
        contact_name: null,
        phone: uc.sender_phone,
        email: null,
        agency_id: uc.agency_id || null,
        agency_name: uc.agency_name || null,
        manychat_subscriber_id: null,
        active_chat_provider: uc.active_chat_provider,
        contact_type: 'unknown' as const,
        unread_count: uc.unread_count || 0,
        last_message_at: uc.last_message_at,
        sender_phone: uc.sender_phone,
        is_blocked: uc.is_blocked || false,
        has_messages: true,
      }));
      
      // Merge base contacts with unknown contacts
      return [...base, ...normalizedUnknown];
    }
    
    return base;
  }, [contacts, unknownContacts, debouncedSearch]);

  // Today's local date parts for robust timezone-safe comparison
  const todayParts = useMemo(() => {
    const t = new Date();
    return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() };
  }, []);

  const isTodayLocal = (iso?: string | null) => {
    if (!iso) return false;
    const d = new Date(iso);
    return d.getFullYear() === todayParts.y && d.getMonth() === todayParts.m && d.getDate() === todayParts.d;
  };

  // Fetch manually marked read contacts (must be before filteredContacts)
  const { data: manuallyReadContacts = [] } = useQuery({
    queryKey: ['manually-read-contacts', tenantId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !tenantId) return [];

      const { data, error } = await supabase
        .from('manually_read_contacts')
        .select('*')
        .eq('user_id', user.id)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('Error fetching manually read contacts:', error);
        return [];
      }
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Check if contact was manually marked as read
  const isManuallyMarkedRead = useCallback((contact: Contact) => {
    return manuallyReadContacts.some(mrc => {
      if (contact.contact_type === 'client' && mrc.client_id === contact.id) return true;
      if (contact.contact_type === 'lead' && mrc.lead_id === contact.id) return true;
      if (contact.contact_type === 'group' && mrc.group_id === contact.id) return true;
      if (contact.contact_type === 'unknown' && contact.sender_phone && mrc.sender_phone === contact.sender_phone) return true;
      return false;
    });
  }, [manuallyReadContacts]);

  // Filter contacts
  const filteredContacts = useMemo(() => {
    let allContacts = allContactsBeforeTypeFilter;
    console.log('🔍 Starting filter - total contacts:', allContacts.length);

    // Filter out blocked contacts
    const beforeBlockFilter = allContacts.length;
    allContacts = allContacts.filter(contact => !contact.is_blocked);
    console.log(`🚫 Blocked filter: ${beforeBlockFilter} → ${allContacts.length}`);

    // Apply contact type filter
    if (contactFilter !== "all") {
      const beforeFilter = allContacts.length;
      // Map plural filter values to singular contact_type values
      const typeToMatch = contactFilter === 'groups' ? 'group' : 
                          contactFilter === 'clients' ? 'client' : 
                          contactFilter === 'leads' ? 'lead' : 
                          contactFilter;
      allContacts = allContacts.filter(contact => contact.contact_type === typeToMatch);
      console.log(`🏷️ Contact type filter (${contactFilter}): ${beforeFilter} → ${allContacts.length}`);
    }

    // Apply today filter (local timezone)
    if (showTodayOnly) {
      const beforeFilter = allContacts.length;
      allContacts = allContacts.filter(contact => isTodayLocal(contact.last_message_at));
      console.log(`📅 Today filter: ${beforeFilter} → ${allContacts.length}`);
    }

    // Apply unread only filter - hide contacts that were MANUALLY marked as read
    if (showUnreadOnly) {
      const beforeFilter = allContacts.length;
      allContacts = allContacts.filter(contact => !isManuallyMarkedRead(contact));
      console.log(`📬 Unread filter (manual): ${beforeFilter} → ${allContacts.length}`);
    }

    console.log('✅ Final filtered contacts:', allContacts.length);
    return allContacts;
  }, [allContactsBeforeTypeFilter, contactFilter, showTodayOnly, showUnreadOnly, todayParts, isManuallyMarkedRead]);

  const clientsCount = allContactsBeforeTypeFilter.filter(c => c.contact_type === 'client').length;
  const leadsCount = allContactsBeforeTypeFilter.filter(c => c.contact_type === 'lead').length;
  const groupsCount = allContactsBeforeTypeFilter.filter(c => c.contact_type === 'group').length;
  const unknownCount = allContactsBeforeTypeFilter.filter(c => c.contact_type === 'unknown').length;

  // Mark as read mutation - now also adds to manually_read_contacts
  const markAsReadMutation = useMutation({
    mutationFn: async (contact: Contact) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !tenantId) throw new Error('No user or tenant found');

      // Update chat_messages read_at
      let query = supabase
        .from('chat_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('connection_user_id', user.id)
        .eq('direction', 'incoming')
        .is('read_at', null);

      if (contact.contact_type === 'client') {
        query = query.eq('client_id', contact.id);
      } else if (contact.contact_type === 'lead') {
        query = query.eq('lead_id', contact.id);
      } else if (contact.contact_type === 'group') {
        query = query.eq('group_id', contact.id);
      } else if (contact.contact_type === 'unknown' && contact.sender_phone) {
        query = query.eq('sender_phone', contact.sender_phone);
      }

      const { error: msgError } = await query;
      if (msgError) throw msgError;

      // Also add to manually_read_contacts table
      const insertData: {
        user_id: string;
        tenant_id: string;
        client_id?: string;
        lead_id?: string;
        group_id?: string;
        sender_phone?: string;
      } = {
        user_id: user.id,
        tenant_id: tenantId,
      };

      if (contact.contact_type === 'client') {
        insertData.client_id = contact.id;
      } else if (contact.contact_type === 'lead') {
        insertData.lead_id = contact.id;
      } else if (contact.contact_type === 'group') {
        insertData.group_id = contact.id;
      } else if (contact.contact_type === 'unknown' && contact.sender_phone) {
        insertData.sender_phone = contact.sender_phone;
      }

      const { error: insertError } = await supabase
        .from('manually_read_contacts')
        .insert(insertData);

      if (insertError) {
        // Ignore duplicate errors (already marked)
        if (!insertError.message.includes('duplicate')) {
          throw insertError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['active-chats'] });
      queryClient.invalidateQueries({ queryKey: ['unknown-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['chat-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['manually-read-contacts'] });
      toast.success('השיחה סומנה כנקראה');
    },
    onError: (error) => {
      console.error('Error marking as read:', error);
      toast.error('שגיאה בסימון כנקרא');
    },
  });

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleEditContact = async (contact: Contact) => {
    if (contact.contact_type === 'client') {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .eq('id', contact.id)
        .single();
      
      if (data) {
        setEditingContact({ id: contact.id, type: 'client', data });
      }
    } else if (contact.contact_type === 'lead') {
      const { data } = await supabase
        .from('leads')
        .select('*')
        .eq('id', contact.id)
        .single();
      
      if (data) {
        setEditingContact({ id: contact.id, type: 'lead', data });
      }
    }
  };

  const handleClearHistory = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      // Delete only messages, NOT blocked_contacts - so blocks persist
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('connection_user_id', user.id);

      if (error) throw error;

      toast.success('ההיסטוריה נוקתה בהצלחה (אנשי קשר חסומים נשארים חסומים)');
      setShowClearHistoryDialog(false);
      setSelectedContact(null);
      
      // Refresh the chats using query invalidation instead of reload
      queryClient.invalidateQueries({ queryKey: ['active-chats'] });
      queryClient.invalidateQueries({ queryKey: ['unknown-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['chat-contacts'] });
    } catch (error) {
      console.error('Error clearing history:', error);
      toast.error('שגיאה בניקוי ההיסטוריה');
    }
  };

  if (agenciesLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">טוען סוכנויות...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden gap-4" dir="rtl">
      {/* Contact List - Hide on mobile when chat is selected */}
      <Card className={`${isMobile && selectedContact ? 'hidden' : 'flex'} flex-col w-full md:w-96 h-full overflow-hidden`}>
        <div className="sticky top-0 z-10 bg-card p-4 border-b space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <h2 className="text-lg font-semibold">צ'אט</h2>
            </div>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setShowClearHistoryDialog(true)}
                title="ניקוי היסטוריה"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <Link to={buildPath('/chat-integrations')}>
                <Button variant="ghost" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="חיפוש איש קשר..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="pr-10"
            />
          </div>

          <div className="space-y-3">
            <Select value={contactFilter || "all"} onValueChange={(value: any) => setContactFilter(value)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                <SelectItem value="all">הכל ({filteredContacts.length})</SelectItem>
                <SelectItem value="clients">לקוחות ({clientsCount})</SelectItem>
                <SelectItem value="leads">לידים ({leadsCount})</SelectItem>
                <SelectItem value="groups">קבוצות ({groupsCount})</SelectItem>
                <SelectItem value="unknown">לא משויכים ({unknownCount})</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-2">
                <Switch
                  id="today-filter"
                  checked={showTodayOnly}
                  onCheckedChange={setShowTodayOnly}
                />
                <Label htmlFor="today-filter" className="text-sm cursor-pointer">
                  הצג רק שיחות מהיום
                </Label>
              </div>
              <div className="flex items-center gap-2 px-2">
                <Switch
                  id="unread-filter"
                  checked={showUnreadOnly}
                  onCheckedChange={setShowUnreadOnly}
                />
                <Label htmlFor="unread-filter" className="text-sm cursor-pointer">
                  הצג רק שיחות לא נקראות
                </Label>
              </div>
            </div>
          </div>

          {/* Header info */}
          <div className="text-muted-foreground text-sm px-2">
            {debouncedSearch ? (
              <span>תוצאות חיפוש עבור "{debouncedSearch}"</span>
            ) : (
              <span>שיחות פעילות</span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-2 space-y-1 overflow-hidden">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg">
                  <Skeleton className="h-12 w-full" />
                </div>
              ))
            ) : filteredContacts.length === 0 ? (
              <div className="text-center p-8 text-muted-foreground">
                {debouncedSearch ? 'לא נמצאו תוצאות' : 'אין שיחות פעילות'}
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const isSelected = selectedContact?.id === contact.id;
                return (
                   <Button
                     key={contact.id}
                    variant={isSelected ? "secondary" : "ghost"}
                    className="w-full min-w-0 justify-start text-right h-auto py-3 px-3 overflow-hidden"
                    onClick={() => {
                      let type: 'client' | 'lead' | 'group' | 'unknown' = 'client';
                      if (contact.contact_type === 'lead') type = 'lead';
                      else if (contact.contact_type === 'group') type = 'group';
                      else if (contact.contact_type === 'unknown') type = 'unknown';
                      
                      setSelectedContact({
                        id: contact.id,
                        type,
                        senderPhone: contact.sender_phone
                      });
                    }}
                  >
                    <div className="flex flex-row-reverse items-center gap-3 w-full min-w-0 overflow-hidden">
                      <Avatar className="h-10 w-10 flex-shrink-0">
                        <AvatarFallback>
                          {(contact.contact_type === 'group' ? contact.name : (contact.contact_name || contact.name))?.charAt(0) || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 text-right">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex-1 min-w-0">
                            <div className="block text-sm font-medium leading-tight truncate" dir="auto">
                              {contact.contact_type === 'group' ? contact.name : (contact.contact_name || contact.name)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {contact.unread_count > 0 && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-5 w-5 p-0 hover:bg-primary/10"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAsReadMutation.mutate(contact);
                                  }}
                                  title="סמן כנקרא"
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                                <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center px-1">
                                  {contact.unread_count}
                                </Badge>
                              </>
                            )}
                            {contact.contact_type === 'unknown' && (
                              <Badge variant="outline" className="text-xs">
                                לא מזוהה
                              </Badge>
                            )}
                            {!contact.has_messages && (
                              <Badge variant="outline" className="text-xs">
                                שיחה חדשה
                              </Badge>
                            )}
                          </div>
                        </div>
                        {contact.agency_name && (
                          <div className="min-w-0">
                            <span className="text-xs text-muted-foreground truncate block" dir="auto">
                              {contact.agency_name}
                            </span>
                          </div>
                        )}
                        {!contact.phone && contact.contact_type !== 'group' && contact.contact_type !== 'unknown' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditContact(contact);
                            }}
                          >
                            <Pencil className="h-3 w-3 ml-1" />
                            עדכן פרטים
                          </Button>
                        )}
                      </div>
                    </div>
                  </Button>
                );
              })
            )}
          </div>
        </div>
      </Card>

      {/* Chat View */}
      <Card className="flex-1 h-full min-h-0 overflow-hidden flex flex-col">
        {selectedContact ? (
          <ChatView
            contactId={selectedContact.id}
            contactType={selectedContact.type}
            senderPhone={selectedContact.senderPhone}
            onBack={isMobile ? () => setSelectedContact(null) : undefined}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">בחר שיחה כדי להתחיל</p>
            </div>
          </div>
        )}
      </Card>

      {/* Edit Contact Dialogs */}
      {editingContact?.type === 'client' && (
        <EditClientDialog
          client={editingContact.data}
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditingContact(null);
          }}
        />
      )}
      
      {editingContact?.type === 'lead' && (
        <EditLeadDialog
          lead={editingContact.data}
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditingContact(null);
          }}
        />
      )}

      <AlertDialog open={showClearHistoryDialog} onOpenChange={setShowClearHistoryDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>האם אתה בטוח?</AlertDialogTitle>
            <AlertDialogDescription>
              פעולה זו תמחק לצמיתות את כל היסטוריית הצ'אטים שלך.
              לא ניתן יהיה לשחזר את המידע לאחר המחיקה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearHistory}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              מחק הכל
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
