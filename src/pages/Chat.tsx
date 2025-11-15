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

export default function Chat() {
  const { clientId } = useParams();
  const { tenantId } = useCurrentTenant();
  const { buildPath } = useTenantPath();
  const { userAgencyIds, isLoading: agenciesLoading } = useUserAgencies();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(clientId || null);

  // Fetch clients with unread message counts from accessible agencies
  const { data: clients, isLoading } = useQuery({
    queryKey: ['chat-clients', tenantId, userAgencyIds, searchTerm],
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

      // Build query for clients with ManyChat
      let query = supabase
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
        .not('manychat_subscriber_id', 'is', null)
        .in('agency_id', allAgencyIds)
        .order('name');

      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Get unread counts for each client
      const clientsWithCounts = await Promise.all(
        (data || []).map(async (client) => {
          const { count } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', client.id)
            .eq('direction', 'inbound')
            .is('read_at', null);

          return {
            ...client,
            unreadCount: count || 0,
          };
        })
      );

      return clientsWithCounts;
    },
    enabled: !!tenantId && !agenciesLoading,
  });

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Clients List */}
      <Card className="w-80 flex flex-col">
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">לקוחות</h3>
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
          ) : clients?.length === 0 ? (
            <div className="p-4 text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-muted-foreground mb-3">לא נמצאו לקוחות עם ManyChat</p>
              <Button variant="outline" size="sm" asChild>
                <Link to={buildPath("/manychat-settings")}>
                  <Settings className="h-4 w-4 ml-2" />
                  חבר ManyChat
                </Link>
              </Button>
            </div>
          ) : (
            <div className="p-2">
              {clients?.map((client) => (
                <button
                  key={client.id}
                  onClick={() => setSelectedClientId(client.id)}
                  className={`w-full text-right p-3 rounded-lg mb-1 transition-colors ${
                    selectedClientId === client.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{client.name}</div>
                      <div className="text-sm opacity-70 truncate">
                        {client.agencies?.name}
                      </div>
                    </div>
                    {client.unreadCount > 0 && (
                      <Badge variant="destructive" className="mr-2">
                        {client.unreadCount}
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
        {selectedClientId ? (
          <ChatView clientId={selectedClientId} />
        ) : (
          <Card className="h-full flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p>בחר לקוח כדי להתחיל שיחה</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
