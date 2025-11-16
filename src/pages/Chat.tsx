import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MessageCircle, Search, Settings, Pencil } from "lucide-react";
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
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const [contactFilter, setContactFilter] = useState<"all" | "clients" | "leads" | "groups" | "unknown">("all");
  const [showTodayOnly, setShowTodayOnly] = useState(false);
  const [selectedContact, setSelectedContact] = useState<{ id: string; type: 'client' | 'lead' | 'group' | 'unknown'; senderPhone?: string } | null>(
    clientId ? { id: clientId, type: 'client' } : null
  );
  const [editingContact, setEditingContact] = useState<{ id: string; type: 'client' | 'lead'; data: any } | null>(null);

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

      const { data, error } = await supabase.rpc('get_chat_contacts');

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

  // Fetch unknown contacts separately for active chats mode only
  const { data: unknownContacts = [] } = useQuery({
    queryKey: ['unknown-contacts', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('chat_messages')
        .select('sender_phone, provider, created_at, direction, read_at, is_blocked')
        .eq('tenant_id', tenantId)
        .is('client_id', null)
        .is('lead_id', null)
        .is('group_id', null)
        .not('sender_phone', 'is', null);

      if (error) {
        console.error('Error fetching unknown contacts:', error);
        return [];
      }

      const grouped = new Map<string, any>();
      data.forEach(msg => {
        const key = normalizePhone(msg.sender_phone);
        if (!key) return;
        
        if (!grouped.has(key)) {
          grouped.set(key, {
            sender_phone: msg.sender_phone,
            active_chat_provider: msg.provider,
            last_message_at: msg.created_at,
            unread_count: 0,
            is_blocked: msg.is_blocked,
          });
        } else {
          const existing = grouped.get(key);
          if (new Date(msg.created_at) > new Date(existing.last_message_at)) {
            existing.last_message_at = msg.created_at;
          }
        }
        
        if ((msg.direction === 'incoming' || msg.direction === 'inbound') && !msg.read_at) {
          grouped.get(key).unread_count++;
        }
      });

      const unknownContactsData = Array.from(grouped.values());
      return unknownContactsData;
    },
    enabled: !!tenantId && !debouncedSearch,
  });

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

  // Filter contacts
  const filteredContacts = useMemo(() => {
    let allContacts = contacts || [];
    console.log('🔍 Starting filter - contacts from DB:', contacts?.length || 0);

    // Add unknown contacts in active chats mode
    if (!debouncedSearch && unknownContacts && unknownContacts.length > 0) {
      const normalizedUnknown = unknownContacts.map(uc => ({
        ...uc,
        id: `unknown-${uc.sender_phone}`,
        name: uc.sender_phone || 'Unknown',
        contact_name: null,
        phone: uc.sender_phone,
        email: null,
        agency_id: null,
        agency_name: null,
        manychat_subscriber_id: null,
        active_chat_provider: uc.active_chat_provider,
        contact_type: 'unknown' as const,
        unread_count: uc.unread_count || 0,
        last_message_at: uc.last_message_at,
        sender_phone: uc.sender_phone,
        is_blocked: uc.is_blocked || false,
        has_messages: true,
      }));
      allContacts = [...allContacts, ...normalizedUnknown];
      console.log('📞 After adding unknown contacts:', allContacts.length);
    }

    // Apply contact type filter
    if (contactFilter !== "all") {
      const beforeFilter = allContacts.length;
      allContacts = allContacts.filter(contact => contact.contact_type === contactFilter);
      console.log(`🏷️ Contact type filter (${contactFilter}): ${beforeFilter} → ${allContacts.length}`);
    }

    // Apply today filter (local timezone)
    if (showTodayOnly) {
      const beforeFilter = allContacts.length;
      allContacts = allContacts.filter(contact => isTodayLocal(contact.last_message_at));
      console.log(`📅 Today filter: ${beforeFilter} → ${allContacts.length}`);
      if (allContacts.length === 0 && beforeFilter > 0) {
        console.log('⚠️ Today filter removed all contacts! Sample dates:', 
          contacts?.slice(0, 3).map(c => ({ date: c.last_message_at, name: c.name }))
        );
      }
    }

    // Apply agency filter if selected
    if (selectedAgency) {
      const beforeFilter = allContacts.length;
      allContacts = allContacts.filter(contact => contact.agency_id === selectedAgency);
      console.log(`🏢 Agency filter: ${beforeFilter} → ${allContacts.length}`);
    }

    console.log('✅ Final filtered contacts:', allContacts.length);
    return allContacts;
  }, [contacts, unknownContacts, debouncedSearch, contactFilter, showTodayOnly, selectedAgency, todayParts]);

  const clientsCount = filteredContacts.filter(c => c.contact_type === 'client').length;
  const leadsCount = filteredContacts.filter(c => c.contact_type === 'lead').length;
  const groupsCount = filteredContacts.filter(c => c.contact_type === 'group').length;
  const unknownCount = filteredContacts.filter(c => c.contact_type === 'unknown').length;

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
    <div className="flex h-[calc(100vh-4rem)] gap-4" dir="rtl">
      {/* Contact List - Hide on mobile when chat is selected */}
      <Card className={`${isMobile && selectedContact ? 'hidden' : 'flex'} flex-col w-full md:w-96 overflow-hidden`}>
        <div className="p-4 border-b space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <h2 className="text-lg font-semibold">צ'אט</h2>
            </div>
            <Link to={buildPath('/chat-integrations')}>
              <Button variant="ghost" size="icon">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
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
            <Select value={contactFilter} onValueChange={(value: any) => setContactFilter(value)}>
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

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
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
                    className="w-full justify-start text-right h-auto p-3"
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
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <span className="font-medium truncate block">
                            {contact.contact_name || contact.name}
                          </span>
                          {contact.contact_name && (
                            <span className="text-sm opacity-70 truncate block">
                              {contact.name}
                            </span>
                          )}
                        </div>
                        {contact.unread_count > 0 && (
                          <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center px-1 shrink-0">
                            {contact.unread_count}
                          </Badge>
                        )}
                        {contact.is_blocked && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            חסום
                          </Badge>
                        )}
                        {contact.contact_type === 'unknown' && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            לא מזוהה
                          </Badge>
                        )}
                        {!contact.has_messages && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            שיחה חדשה
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {contact.agency_name && (
                          <span className="text-sm text-muted-foreground truncate">
                            {contact.agency_name}
                          </span>
                        )}
                        {!contact.phone && contact.contact_type !== 'group' && contact.contact_type !== 'unknown' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs shrink-0"
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
        </ScrollArea>
      </Card>

      {/* Chat View */}
      <Card className="flex-1 overflow-hidden flex flex-col">
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
    </div>
  );
}
