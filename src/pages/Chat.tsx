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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageCircle, Search, Settings, Loader2, Pencil } from "lucide-react";
import ChatView from "@/components/chat/ChatView";
import { EditClientDialog } from "@/components/forms/EditClientDialog";

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
  contact_type: 'client' | 'lead' | 'unknown';
  last_message_at: string | null;
  sender_phone?: string;
  is_blocked?: boolean;
}
// Normalize phone for comparison: strip non-digits and standardize to local part
const normalizePhone = (phone?: string | null) => {
  if (!phone) return '';
  const digits = (phone.match(/\d+/g) || []).join('');
  // Remove international prefixes and common country codes (e.g., 972)
  let p = digits.replace(/^00/, '');
  if (p.startsWith('972')) p = p.slice(3);
  if (p.startsWith('0')) p = p.slice(1);
  // Keep last 9 digits (Israeli local numbers)
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
  const [contactFilter, setContactFilter] = useState<"all" | "clients" | "leads" | "unknown">("all");
  const [syncStatusFilter, setSyncStatusFilter] = useState<"all" | "synced" | "unsynced">("all");
  const [selectedContact, setSelectedContact] = useState<{ id: string; type: 'client' | 'lead' | 'unknown'; senderPhone?: string } | null>(
    clientId ? { id: clientId, type: 'client' } : null
  );
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [editingClient, setEditingClient] = useState<any>(null);
  const CONTACTS_PER_PAGE = 50;

  // Count unsynced clients
  const { data: unsyncedCount } = useQuery({
    queryKey: ['unsynced-clients-count', tenantId],
    queryFn: async () => {
      if (!tenantId) return 0;
      
      const { count } = await supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .is('manychat_subscriber_id', null);
      
      return count || 0;
    },
    enabled: !!tenantId,
  });

  // Fetch contacts using optimized database function
  const { data: contacts, isLoading, isFetching } = useQuery({
    queryKey: ['chat-contacts', tenantId, userAgencyIds, debouncedSearch, page, selectedAgency],
    queryFn: async () => {
      console.log('🔍 Fetching contacts - tenantId:', tenantId, 'userAgencyIds:', userAgencyIds, 'selectedAgency:', selectedAgency);
      
      if (!tenantId) {
        console.warn('⚠️ Contacts query skipped - missing tenantId');
        return [];
      }

      console.time('⏱️ Chat contacts query');

      // Call the RPC function without parameters
      const { data, error } = await supabase
        .rpc('get_chat_contacts');

      console.timeEnd('⏱️ Chat contacts query');

      if (error) {
        console.error('❌ Contacts error:', error);
        throw error;
      }

      // Update hasMore flag
      setHasMore(false); // No pagination for now

      return (data || []).map((row: any) => ({
        id: row.contact_id || `unknown-${row.phone}`,
        name: row.name,
        contact_name: row.contact_name,
        phone: row.phone,
        email: row.email,
        agency_id: row.agency_id,
        agency_name: row.agency_name,
        manychat_subscriber_id: row.manychat_subscriber_id,
        active_chat_provider: row.active_chat_provider,
        unread_count: row.unread_count || 0,
        contact_type: row.contact_type,
        last_message_at: row.last_message_at,
        is_blocked: row.is_blocked || false,
        sender_phone: row.phone,
      }));
    },
    enabled: !!tenantId,
    staleTime: 30000, // 30 seconds
    refetchInterval: (query) => {
      // Only refetch if user is active and there are contacts
      return query.state.data && query.state.data.length > 0 ? 30000 : false;
    },
  });

  // Fetch unknown contacts
  const { data: unknownContacts = [] } = useQuery({
    queryKey: ['unknown-contacts', tenantId, debouncedSearch],
    queryFn: async () => {
      if (!tenantId) return [];

      const query = supabase
        .from('chat_messages')
        .select('sender_phone, sender_name, created_at, is_blocked')
        .eq('tenant_id', tenantId)
        .is('client_id', null)
        .is('lead_id', null)
        .order('created_at', { ascending: false });

      if (debouncedSearch) {
        query.or(`sender_phone.ilike.%${debouncedSearch}%,sender_name.ilike.%${debouncedSearch}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Group by sender_phone and count unread
      const grouped = data?.reduce((acc: any[], msg: any) => {
        const existing = acc.find(c => c.sender_phone === msg.sender_phone);
        if (existing) {
          existing.last_message_at = msg.created_at;
        } else {
          acc.push({
            id: msg.sender_phone,
            name: msg.sender_name || msg.sender_phone,
            phone: msg.sender_phone,
            sender_phone: msg.sender_phone,
            email: null,
            agency_id: null,
            agency_name: null,
            manychat_subscriber_id: null,
            active_chat_provider: null,
            unread_count: 0,
            contact_type: 'unknown' as const,
            last_message_at: msg.created_at,
            is_blocked: msg.is_blocked,
          });
        }
        return acc;
      }, []) || [];

      // Count unread for each
      for (const contact of grouped) {
        const { count } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('sender_phone', contact.sender_phone)
          .eq('direction', 'inbound')
          .is('read_at', null);
        contact.unread_count = count || 0;
      }

      return grouped;
    },
    enabled: !!tenantId,
    staleTime: 30000,
  });

  // Filter contacts by type and sync status with memoization
  const filteredContacts = useMemo(() => {
    // Merge known contacts with unknown contacts
    const allContacts = [
      ...(contacts || []),
      ...(unknownContacts || [])
    ];

    // Build a set of known phone numbers (clients/leads) to avoid showing them as unknown too
    const knownPhones = new Set(
      (contacts || [])
        .map(c => normalizePhone(c.phone))
        .filter(Boolean)
    );
    
    return allContacts.filter(contact => {
      // Hide unknown contact if its phone already belongs to a known contact (compare normalized)
      if (contact.contact_type === 'unknown' && knownPhones.has(normalizePhone(contact.phone))) {
        return false;
      }

      // Filter by contact type
      if (contactFilter === "clients" && contact.contact_type !== "client") return false;
      if (contactFilter === "leads" && contact.contact_type !== "lead") return false;
      if (contactFilter === "unknown" && contact.contact_type !== "unknown") return false;
      
      // Filter by sync status (only for clients/leads, not unknown)
      if (contact.contact_type !== 'unknown') {
        if (syncStatusFilter === "synced" && !contact.manychat_subscriber_id) return false;
        if (syncStatusFilter === "unsynced" && contact.manychat_subscriber_id) return false;
      }
      
      return true;
    });
  }, [contacts, unknownContacts, contactFilter, syncStatusFilter]);

  // Count unknown items after excluding phones that belong to known contacts
  const unknownCount = useMemo(() => {
    const knownPhones = new Set(
      (contacts || [])
        .map(c => normalizePhone(c.phone))
        .filter(Boolean)
    );
    return (unknownContacts || []).filter((u: any) => !knownPhones.has(normalizePhone(u.phone))).length;
  }, [contacts, unknownContacts]);

  const handleLoadMore = () => {
    if (hasMore && !isFetching) {
      setPage(prev => prev + 1);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setPage(0); // Reset pagination on search
  };

  return (
    <div className="flex h-[calc(100dvh-8rem)] md:h-[calc(100vh-8rem)] gap-4 overflow-hidden">
      {/* Clients List - Hidden on mobile when contact selected */}
      {(isMobile ? !selectedContact : true) && (
        	<Card className={`${isMobile ? 'w-full' : 'w-80'} flex-shrink-0 flex flex-col overflow-hidden h-full`}>
        	  <div className="p-4 border-b space-y-3">
        	    <div className="flex items-center justify-between">
        	      <div className="flex items-center gap-2">
        	        <h3 className="font-semibold">אנשי קשר</h3>
        	        {unsyncedCount !== undefined && unsyncedCount > 0 && (
        	          <Badge variant="secondary" className="text-xs">
        	            {unsyncedCount} לא מסונכרנים
        	          </Badge>
        	        )}
        	      </div>
        	      <Button
        	        variant="outline"
        	        size="sm"
        	        asChild
        	      >
        	        <Link to={buildPath("/manychat-settings")}>
        	          <Settings className="h-4 w-4 ml-2" />
        	          הגדרות ManyChat
        	        </Link>
        	      </Button>
        	    </div>
        	    <div className="relative">
        	      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        	      <Input
        	        placeholder="חפש לקוח..."
        	        value={searchTerm}
        	        onChange={(e) => setSearchTerm(e.target.value)}
        	        className="pl-9"
        	      />
        	    </div>
        	    
        	    <Select value={syncStatusFilter} onValueChange={(value) => setSyncStatusFilter(value as any)}>
        	      <SelectTrigger className="text-right" dir="rtl">
        	        <SelectValue placeholder="סטטוס סנכרון" />
        	      </SelectTrigger>
        	      <SelectContent>
        	        <SelectItem value="all">הכל</SelectItem>
        	        <SelectItem value="synced">מסונכרנים</SelectItem>
        	        <SelectItem value="unsynced">לא מסונכרנים</SelectItem>
        	      </SelectContent>
        	    </Select>
        	    
        	    <Tabs value={contactFilter} onValueChange={(v) => setContactFilter(v as typeof contactFilter)} className="w-full">
        	      <TabsList className="grid w-full grid-cols-4">
        	        <TabsTrigger value="all">הכל</TabsTrigger>
        	        <TabsTrigger value="clients">לקוחות</TabsTrigger>
        	        <TabsTrigger value="leads">לידים</TabsTrigger>
        	        <TabsTrigger value="unknown">
        	          לא מוגדר
        	          {unknownCount > 0 && (
        	            <Badge variant="secondary" className="mr-1 text-xs">{unknownCount}</Badge>
        	          )}
        	        </TabsTrigger>
        	      </TabsList>
        	    </Tabs>
        	  </div>
        	  <ScrollArea className="flex-1">
        	    {isLoading ? (
        	      <div className="p-4 text-center text-muted-foreground">טוען...</div>
        	    ) : filteredContacts?.length === 0 ? (
        	      <div className="p-4 text-center">
        	        <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
        	        <p className="text-muted-foreground mb-3">לא נמצאו אנשי קשר</p>
        	        <Button variant="outline" size="sm" asChild>
        	          <Link to={buildPath("/chat-integrations")}>
        	            <Settings className="h-4 w-4 ml-2" />
        	            הגדרות אינטגרציות
        	          </Link>
        	        </Button>
        	      </div>
        	    ) : (
        	      <div className="p-2">
        	        {filteredContacts?.map((contact) => (
        	          <button
        	            key={contact.id}
        	            onClick={() => setSelectedContact({ 
        	              id: contact.id, 
        	              type: contact.contact_type as 'client' | 'lead' | 'unknown',
        	              senderPhone: (contact as any).sender_phone 
        	            })}
        	            className={`w-full text-right p-3 rounded-lg mb-1 transition-colors ${
        	              selectedContact?.id === contact.id
        	                ? 'bg-primary text-primary-foreground'
        	                : 'hover:bg-accent'
        	            } ${(contact as any).is_blocked ? 'opacity-50' : ''}`}
        	          >
        	            <div className="flex items-center justify-between gap-2">
        	              {contact.unread_count > 0 && (
        	                <Badge variant="destructive" className="shrink-0">
        	                  {contact.unread_count}
        	                </Badge>
        	              )}
        	              <div className="flex-1 min-w-0 text-right">
        	                <div className="font-medium truncate mb-1 flex items-center gap-2 justify-end">
        	                  {contact.name}
        	                  {contact.contact_type === 'unknown' && (
        	                    <Badge variant="outline" className="text-xs">לא מוגדר</Badge>
        	                  )}
        	                  {(contact as any).is_blocked && (
        	                    <Badge variant="destructive" className="text-xs">חסום</Badge>
        	                  )}
        	                </div>
        	                <div className="flex items-center justify-end gap-1.5 mb-1 flex-wrap">
        	                  {contact.active_chat_provider === 'manychat' && !contact.manychat_subscriber_id && (
        	                    <Badge variant="secondary" className="text-xs shrink-0">
        	                      לא מסונכרן
        	                    </Badge>
        	                  )}
        	                  {contact.active_chat_provider === 'green_api' && !contact.phone && (
        	                    <Badge variant="secondary" className="text-xs shrink-0">
        	                      חסר טלפון
        	                    </Badge>
        	                  )}
        	                  {contact.contact_type === 'lead' && (
        	                    <Badge variant="outline" className="text-xs shrink-0">
        	                      ליד
        	                    </Badge>
        	                  )}
        	                </div>
        	                <div className="text-sm opacity-70 truncate">
        	                  {contact.agency_name}
        	                </div>
        	              </div>
        	            </div>
        	          </button>
        	        ))}
        	      </div>
        	    )}
        	  </ScrollArea>
        	</Card>
      )}

      {/* Chat View - Full width on mobile when contact selected */}
      <div className={`${isMobile ? (selectedContact ? 'w-full flex flex-col' : 'hidden') : 'flex-1'} h-full`}>
        {selectedContact ? (
          <ChatView 
            contactId={selectedContact.id} 
            contactType={selectedContact.type}
            onBack={isMobile ? () => setSelectedContact(null) : undefined}
          />
        ) : (
          <Card className="h-full flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p>בחר איש קשר כדי להתחיל שיחה</p>
            </div>
          </Card>
        )}
      </div>
      
      {editingClient && (
        <EditClientDialog
          client={editingClient}
          open={!!editingClient}
          onOpenChange={(open) => {
            if (!open) setEditingClient(null);
          }}
        />
      )}
    </div>
  );
}
