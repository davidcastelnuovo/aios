import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useUserAgencies } from "@/hooks/useUserAgencies";
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
import { MessageCircle, Search, Settings, Loader2 } from "lucide-react";
import ChatView from "@/components/chat/ChatView";

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  agency_id: string;
  agency_name: string | null;
  manychat_subscriber_id: string | null;
  unread_count: number;
  contact_type: 'client' | 'lead';
  last_message_at: string | null;
}

export default function Chat() {
  const { clientId } = useParams();
  const { tenantId } = useCurrentTenant();
  const { buildPath } = useTenantPath();
  const { userAgencyIds, isLoading: agenciesLoading } = useUserAgencies();
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebouncedValue(searchTerm, 300);
  const [contactFilter, setContactFilter] = useState<"all" | "clients" | "leads">("all");
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>("all");
  const [syncStatusFilter, setSyncStatusFilter] = useState<"all" | "synced" | "unsynced">("all");
  const [selectedContact, setSelectedContact] = useState<{ id: string; type: 'client' | 'lead' } | null>(
    clientId ? { id: clientId, type: 'client' } : null
  );
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
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
    queryKey: ['chat-contacts', tenantId, userAgencyIds, debouncedSearch, page],
    queryFn: async () => {
      console.log('🔍 Fetching contacts - tenantId:', tenantId, 'userAgencyIds:', userAgencyIds);
      
      if (!tenantId) {
        console.warn('⚠️ Contacts query skipped - missing tenantId');
        return [];
      }

      console.time('⏱️ Chat contacts query');

      // Get all accessible agency IDs (owned + shared)
      const { data: ownedAgencies } = await supabase
        .from('agencies')
        .select('id')
        .eq('tenant_id', tenantId);

      const { data: sharedAgencies } = await supabase
        .from('agency_tenant_access')
        .select('agency_id')
        .eq('accessing_tenant_id', tenantId);

      const allAgencyIds = [
        ...(ownedAgencies || []).map(a => a.id),
        ...(sharedAgencies || []).map(a => a.agency_id)
      ];

      if (allAgencyIds.length === 0) {
        console.timeEnd('⏱️ Chat contacts query');
        return [];
      }

      // Call optimized database function
      const { data, error } = await supabase.rpc('get_chat_contacts', {
        p_tenant_id: tenantId,
        p_agency_ids: allAgencyIds,
        p_search_term: debouncedSearch || null,
        p_limit: CONTACTS_PER_PAGE,
        p_offset: page * CONTACTS_PER_PAGE
      });

      console.timeEnd('⏱️ Chat contacts query');

      if (error) {
        console.error('❌ Contacts error:', error);
        throw error;
      }

      // Update hasMore flag
      setHasMore((data || []).length === CONTACTS_PER_PAGE);

      return data || [];
    },
    enabled: !!tenantId,
    staleTime: 30000, // 30 seconds
    refetchInterval: (query) => {
      // Only refetch if user is active and there are contacts
      return query.state.data && query.state.data.length > 0 ? 30000 : false;
    },
  });

  // Get unique agencies from contacts
  const agencies = useMemo(() => {
    if (!contacts) return [];
    const uniqueAgencies = new Map<string, string>();
    contacts.forEach(contact => {
      if (contact.agency_id && contact.agency_name) {
        uniqueAgencies.set(contact.agency_id, contact.agency_name);
      }
    });
    return Array.from(uniqueAgencies.entries()).map(([id, name]) => ({ id, name }));
  }, [contacts]);

  // Filter contacts by type with memoization
  const filteredContacts = useMemo(() => {
    return (contacts || []).filter(contact => {
      // Filter by contact type
      if (contactFilter === "clients" && contact.contact_type !== "client") return false;
      if (contactFilter === "leads" && contact.contact_type !== "lead") return false;
      
      // Filter by agency
      if (selectedAgencyId !== "all" && contact.agency_id !== selectedAgencyId) return false;
      
      // Filter by sync status
      if (syncStatusFilter === "synced" && !contact.manychat_subscriber_id) return false;
      if (syncStatusFilter === "unsynced" && contact.manychat_subscriber_id) return false;
      
      return true;
    });
  }, [contacts, contactFilter, selectedAgencyId, syncStatusFilter]);

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
    <div className="flex h-[calc(100vh-8rem)] gap-4 overflow-hidden">
      {/* Clients List - Hidden on mobile when contact selected */}
      <Card className={`${isMobile ? (selectedContact ? 'hidden' : 'w-full') : 'w-80'} flex-shrink-0 flex flex-col overflow-hidden`}>
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
          
          <div className="grid grid-cols-2 gap-2">
            <Select value={selectedAgencyId} onValueChange={setSelectedAgencyId}>
              <SelectTrigger className="text-right" dir="rtl">
                <SelectValue placeholder="כל הסוכנויות" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הסוכנויות</SelectItem>
                {agencies.map(agency => (
                  <SelectItem key={agency.id} value={agency.id}>
                    {agency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

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
          </div>
          
          <Tabs value={contactFilter} onValueChange={(v) => setContactFilter(v as typeof contactFilter)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">הכל</TabsTrigger>
              <TabsTrigger value="clients">לקוחות</TabsTrigger>
              <TabsTrigger value="leads">לידים</TabsTrigger>
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
                <Link to={buildPath("/manychat-settings")}>
                  <Settings className="h-4 w-4 ml-2" />
                  חבר ManyChat
                </Link>
              </Button>
            </div>
          ) : (
            <div className="p-2">
              {filteredContacts?.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => setSelectedContact({ id: contact.id, type: contact.contact_type as 'client' | 'lead' })}
                  className={`w-full text-right p-3 rounded-lg mb-1 transition-colors ${
                    selectedContact?.id === contact.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    {contact.unread_count > 0 && (
                      <Badge variant="destructive" className="shrink-0">
                        {contact.unread_count}
                      </Badge>
                    )}
                    <div className="flex-1 min-w-0 text-right">
                      <div className="font-medium truncate mb-1">
                        {contact.name}
                      </div>
                      <div className="flex items-center justify-end gap-1.5 mb-1 flex-wrap">
                        {!contact.manychat_subscriber_id && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            לא מסונכרן
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

      {/* Chat View - Full width on mobile when contact selected */}
      <div className={`${isMobile ? (selectedContact ? 'w-full' : 'hidden') : 'flex-1'}`}>
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
    </div>
  );
}
