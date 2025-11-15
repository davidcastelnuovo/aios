import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useTenantPath } from "@/hooks/useTenantPath";
import { useUserAgencies } from "@/hooks/useUserAgencies";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Search, Settings } from "lucide-react";
import ChatView from "@/components/chat/ChatView";

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  agency_id: string;
  agencies: { name: string } | null;
  manychat_subscriber_id: string | null;
  unreadCount: number;
  type: 'client' | 'lead';
}

export default function Chat() {
  const { clientId } = useParams();
  const { tenantId } = useCurrentTenant();
  const { buildPath } = useTenantPath();
  const { userAgencyIds, isLoading: agenciesLoading } = useUserAgencies();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContact, setSelectedContact] = useState<{ id: string; type: 'client' | 'lead' } | null>(
    clientId ? { id: clientId, type: 'client' } : null
  );

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

  // Fetch contacts (clients + leads) with unread message counts
  const { data: contacts, isLoading } = useQuery({
    queryKey: ['chat-contacts', tenantId, userAgencyIds, searchTerm],
    queryFn: async () => {
      if (!tenantId) return [];

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

      if (allAgencyIds.length === 0) return [];

      // Fetch CLIENTS
      let clientQuery = supabase
        .from('clients')
        .select(`
          id,
          name,
          phone,
          email,
          agency_id,
          agencies (name),
          manychat_subscriber_id
        `)
        .in('agency_id', allAgencyIds)
        .order('name');

      if (searchTerm) {
        clientQuery = clientQuery.ilike('name', `%${searchTerm}%`);
      }

    const { data: clients, error: clientsError } = await clientQuery;
    if (clientsError) {
      console.error('❌ Clients error:', clientsError);
      throw clientsError;
    }

    // Fetch LEADS
    let leadQuery = supabase
      .from('leads')
      .select(`
        id,
        company_name,
        phone,
        email,
        agency_id,
        agencies (name),
        manychat_subscriber_id
      `)
      .in('agency_id', allAgencyIds)
      .order('company_name');

    if (searchTerm) {
      leadQuery = leadQuery.ilike('company_name', `%${searchTerm}%`);
    }

    const { data: leads, error: leadsError } = await leadQuery;
    if (leadsError) {
      console.error('❌ Leads error:', leadsError);
      throw leadsError;
    }

    // Build ID lists for batch counting
    const clientIds = (clients || []).map(c => c.id);
    const leadIds = (leads || []).map(l => l.id);

    // Fetch unread counts in 2 batched queries (clients + leads)
    const [clientUnreadRes, leadUnreadRes] = await Promise.all([
      clientIds.length > 0
        ? supabase
            .from('chat_messages')
            .select('client_id')
            .eq('direction', 'inbound')
            .is('read_at', null)
            .in('client_id', clientIds)
        : Promise.resolve({ data: [] as any[] }),
      leadIds.length > 0
        ? supabase
            .from('chat_messages')
            .select('lead_id')
            .eq('direction', 'inbound')
            .is('read_at', null)
            .in('lead_id', leadIds)
        : Promise.resolve({ data: [] as any[] })
    ]);

    const clientUnreadMap = new Map<string, number>();
    (clientUnreadRes.data || []).forEach((row: any) => {
      if (row.client_id) {
        clientUnreadMap.set(row.client_id, (clientUnreadMap.get(row.client_id) || 0) + 1);
      }
    });

    const leadUnreadMap = new Map<string, number>();
    (leadUnreadRes.data || []).forEach((row: any) => {
      if (row.lead_id) {
        leadUnreadMap.set(row.lead_id, (leadUnreadMap.get(row.lead_id) || 0) + 1);
      }
    });

    // Combine to unified contacts list
    const allContacts: Contact[] = [
      ...(clients || []).map((client: any) => ({
        ...client,
        type: 'client' as const,
        unreadCount: clientUnreadMap.get(client.id) ?? 0,
      })),
      ...(leads || []).map((lead: any) => ({
        id: lead.id,
        name: lead.company_name,
        phone: lead.phone,
        email: lead.email,
        agency_id: lead.agency_id,
        agencies: lead.agencies,
        manychat_subscriber_id: lead.manychat_subscriber_id,
        type: 'lead' as const,
        unreadCount: leadUnreadMap.get(lead.id) ?? 0,
      }))
    ];

    // Sort by unread first, then by name
    return allContacts.sort((a, b) => {
      if (a.unreadCount !== b.unreadCount) {
        return b.unreadCount - a.unreadCount;
      }
      return a.name.localeCompare(b.name, 'he');
    });
    },
    enabled: !!tenantId && !agenciesLoading,
  });

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Clients List */}
      <Card className="w-80 flex flex-col">
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
        </div>
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">טוען...</div>
          ) : contacts?.length === 0 ? (
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
              {contacts?.map((contact) => (
                <button
                  key={`${contact.type}-${contact.id}`}
                  onClick={() => setSelectedContact({ id: contact.id, type: contact.type })}
                  className={`w-full text-right p-3 rounded-lg mb-1 transition-colors ${
                    selectedContact?.id === contact.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium truncate">{contact.name}</span>
                        {contact.type === 'lead' && (
                          <Badge variant="outline" className="text-xs shrink-0">
                            ליד
                          </Badge>
                        )}
                        {!contact.manychat_subscriber_id && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            לא מסונכרן
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm opacity-70 truncate">
                        {contact.agencies?.name}
                      </div>
                    </div>
                    {contact.unreadCount > 0 && (
                      <Badge variant="destructive" className="mr-2 shrink-0">
                        {contact.unreadCount}
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Chat View */}
      <div className="flex-1">
        {selectedContact ? (
          <ChatView contactId={selectedContact.id} contactType={selectedContact.type} />
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
