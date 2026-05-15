import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Facebook, FileSpreadsheet, TrendingUp, TrendingDown, Minus, ShoppingCart, LayoutGrid, Activity, MessageSquare, Pencil } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, ComposedChart, Area } from "recharts";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";
import { useUserRole } from "@/hooks/useUserRole";
import { differenceInDays } from "date-fns";
import { calculateHealthScore, getEffectiveStatus, FLAG_LABELS, FLAG_COLORS, OVERALL_STATUS_CONFIG, TIER_COLORS, SERVICE_LABELS, COMMUNICATION_STATUS_LABELS, COMMUNICATION_STATUS_COLORS, type FlagKey, type OverallStatus } from "@/lib/healthScore";

import { SeoUpdateModal } from "@/components/clients/SeoUpdateModal";
import { ManualHealthEditDialog } from "@/components/clients/ManualHealthEditDialog";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

interface AgencyDashboardContentProps {
  agencyId: string;
  agencyName: string;
  dateFilter: string;
}

interface CampaignRecord {
  campaignName: string;
  impressions: number;
  clicks: number;
  leads: number;
  purchases: number;
  spend: number;
  revenue: number;
  addToCart?: number;
}

interface ClientTableData {
  clientId: string;
  clientName: string;
  tableId: string;
  tableName: string;
  integrationType: string;
  campaignType: 'leads' | 'ecommerce';
  records: CampaignRecord[];
  totals: CampaignRecord;
}

type PlatformFilter = 'all' | 'facebook' | 'google_ads' | 'google_analytics';

const PLATFORM_CONFIG: Record<string, { name: string; color: string; bgColor: string }> = {
  facebook_insights: { name: 'Facebook', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  facebook_ecommerce: { name: 'Facebook', color: 'text-blue-600', bgColor: 'bg-blue-100' },
  google_ads: { name: 'Google Ads', color: 'text-red-500', bgColor: 'bg-red-100' },
  google_analytics: { name: 'Analytics', color: 'text-orange-500', bgColor: 'bg-orange-100' },
};

const isFacebookPlatform = (source: string) => ['facebook_insights', 'facebook_ecommerce'].includes(source);
const isAdsPlatform = (source: string) => ['facebook_insights', 'facebook_ecommerce', 'google_ads'].includes(source);
const isAnalyticsPlatform = (source: string) => source === 'google_analytics';
const isGoogleAdsPlatform = (source: string) => source === 'google_ads';

const matchesPlatformFilter = (integrationType: string, filter: PlatformFilter): boolean => {
  if (filter === 'all') return true;
  if (filter === 'facebook') return isFacebookPlatform(integrationType);
  if (filter === 'google_ads') return isGoogleAdsPlatform(integrationType);
  if (filter === 'google_analytics') return isAnalyticsPlatform(integrationType);
  return true;
};

const getSpendFromData = (data: any) => Number(data?.spend) || Number(data?.cost) || 0;
const getRevenueFromData = (data: any) =>
  Number(data?.purchase_value) || Number(data?.purchaseRevenue) || Number(data?.conversions_value) || Number(data?.conversion_value) || 0;
const getLeadsFromData = (data: any) =>
  Number(data?.leads) || Number(data?.conversions) || Number(data?.website_leads) ||
  Number(data?.offsite_conversion) || Number(data?.offsite_conversion_fb_pixel_lead) || Number(data?.leadgen_grouped) || Number(data?.lead) || 0;
const getPurchasesFromData = (data: any) => Number(data?.purchases) || Number(data?.ecommercePurchases) || Number(data?.transactions) || 0;
const getSessionsFromData = (data: any) => Number(data?.sessions) || 0;
const getAddToCartFromData = (data: any) => Number(data?.add_to_cart) || Number(data?.addToCarts) || 0;

const getCampaignType = (integrationType: string, integrationSettings?: any): 'leads' | 'ecommerce' => {
  if (integrationType === 'facebook_insights') return 'leads';
  if (integrationType === 'facebook_ecommerce') return 'ecommerce';
  if (integrationType === 'google_ads') {
    return integrationSettings?.campaign_type === 'ecommerce' ? 'ecommerce' : 'leads';
  }
  return 'leads';
};

const getIntegrationIcon = (type: string) => {
  switch (type) {
    case 'facebook_insights':
    case 'facebook_ecommerce':
      return <Facebook className="h-4 w-4 text-blue-600" />;
    case 'google_ads':
      return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
          <path d="M3.654 14.916l6.26-10.857c.68-1.18 2.184-1.59 3.361-.916l.004.003c1.178.68 1.586 2.184.909 3.361l-6.26 10.857c-.68 1.18-2.184 1.59-3.361.916l-.004-.003c-1.178-.68-1.586-2.184-.909-3.361z" fill="#FBBC04"/>
          <path d="M14.088 14.916l6.26-10.857c.68-1.18.27-2.684-.909-3.361l-.004-.003c-1.177-.674-2.681-.264-3.361.916l-6.26 10.857c-.68 1.18-.27 2.684.909 3.361l.004.003c1.177.674 2.681.264 3.361-.916z" fill="#4285F4"/>
          <circle cx="6" cy="18" r="3.5" fill="#34A853"/>
        </svg>
      );
    case 'google_analytics':
      return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
          <path d="M20.5 18.5v-13c0-1.1-.9-2-2-2h-1c-1.1 0-2 .9-2 2v13c0 1.1.9 2 2 2h1c1.1 0 2-.9 2-2z" fill="#F9AB00"/>
          <path d="M13.5 18.5v-7c0-1.1-.9-2-2-2h-1c-1.1 0-2 .9-2 2v7c0 1.1.9 2 2 2h1c1.1 0 2-.9 2-2z" fill="#E37400"/>
          <circle cx="5" cy="18.5" r="2.5" fill="#E37400"/>
        </svg>
      );
    default:
      return <FileSpreadsheet className="h-4 w-4" />;
  }
};

const formatCurrency = (num: number) => {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    maximumFractionDigits: 0,
  }).format(num);
};

const formatNumber = (num: number) => {
  return new Intl.NumberFormat('he-IL').format(Math.round(num));
};

type CRMClientFields = {
  id: string;
  tier?: string | null;
  services?: string[] | null;
  mood_status?: string | null;
};

// Leads Table Component
function LeadsTable({ records, totals }: { records: CampaignRecord[]; totals: CampaignRecord }) {
  const getCPL = (spend: number, leads: number) => leads > 0 ? spend / leads : 0;
  
  return (
    <Table dir="rtl">
      <TableHeader>
        <TableRow>
          <TableHead className="text-right">קמפיין</TableHead>
          <TableHead className="text-right">חשיפות</TableHead>
          <TableHead className="text-right">קליקים</TableHead>
          <TableHead className="text-right">לידים</TableHead>
          <TableHead className="text-right">הוצאה</TableHead>
          <TableHead className="text-right">עלות לליד</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record, idx) => (
          <TableRow key={idx}>
            <TableCell className="font-medium">{record.campaignName || 'ללא שם'}</TableCell>
            <TableCell>{formatNumber(record.impressions)}</TableCell>
            <TableCell>{formatNumber(record.clicks)}</TableCell>
            <TableCell>{formatNumber(record.leads)}</TableCell>
            <TableCell>{formatCurrency(record.spend)}</TableCell>
            <TableCell>{formatCurrency(getCPL(record.spend, record.leads))}</TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/50 font-bold border-t-2">
          <TableCell>סה"כ</TableCell>
          <TableCell>{formatNumber(totals.impressions)}</TableCell>
          <TableCell>{formatNumber(totals.clicks)}</TableCell>
          <TableCell>{formatNumber(totals.leads)}</TableCell>
          <TableCell>{formatCurrency(totals.spend)}</TableCell>
          <TableCell>{formatCurrency(getCPL(totals.spend, totals.leads))}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

// Ecommerce Table Component
function EcommerceTable({ records, totals }: { records: CampaignRecord[]; totals: CampaignRecord }) {
  const getRoas = (revenue: number, spend: number) => spend > 0 ? revenue / spend : 0;
  
  return (
    <Table dir="rtl">
      <TableHeader>
        <TableRow>
          <TableHead className="text-right">קמפיין</TableHead>
          <TableHead className="text-right">חשיפות</TableHead>
          <TableHead className="text-right">קליקים</TableHead>
          <TableHead className="text-right">רכישות</TableHead>
          <TableHead className="text-right">הוצאה</TableHead>
          <TableHead className="text-right">הכנסה</TableHead>
          <TableHead className="text-right">ROAS</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record, idx) => {
          const roas = getRoas(record.revenue, record.spend);
          return (
            <TableRow key={idx}>
              <TableCell className="font-medium">{record.campaignName || 'ללא שם'}</TableCell>
              <TableCell>{formatNumber(record.impressions)}</TableCell>
              <TableCell>{formatNumber(record.clicks)}</TableCell>
              <TableCell>{formatNumber(record.purchases)}</TableCell>
              <TableCell>{formatCurrency(record.spend)}</TableCell>
              <TableCell>{formatCurrency(record.revenue)}</TableCell>
              <TableCell>
                <span className={roas >= 1 ? 'text-green-600 font-semibold' : 'text-red-600'}>
                  {roas.toFixed(2)}
                </span>
              </TableCell>
            </TableRow>
          );
        })}
        <TableRow className="bg-muted/50 font-bold border-t-2">
          <TableCell>סה"כ</TableCell>
          <TableCell>{formatNumber(totals.impressions)}</TableCell>
          <TableCell>{formatNumber(totals.clicks)}</TableCell>
          <TableCell>{formatNumber(totals.purchases)}</TableCell>
          <TableCell>{formatCurrency(totals.spend)}</TableCell>
          <TableCell>{formatCurrency(totals.revenue)}</TableCell>
          <TableCell>
            <span className={getRoas(totals.revenue, totals.spend) >= 1 ? 'text-green-600' : 'text-red-600'}>
              {getRoas(totals.revenue, totals.spend).toFixed(2)}
            </span>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

// Analytics Table Component
function AnalyticsTable({ records, totals }: { records: CampaignRecord[]; totals: CampaignRecord }) {
  return (
    <Table dir="rtl">
      <TableHeader>
        <TableRow>
          <TableHead className="text-right">מקור / ערוץ</TableHead>
          <TableHead className="text-right">סשנים</TableHead>
          <TableHead className="text-right">הוספות לעגלה</TableHead>
          <TableHead className="text-right">רכישות</TableHead>
          <TableHead className="text-right">הכנסות</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record, idx) => (
          <TableRow key={idx}>
            <TableCell className="font-medium">{record.campaignName || 'Unknown'}</TableCell>
            <TableCell>{formatNumber(record.impressions)}</TableCell>
            <TableCell>{formatNumber(record.addToCart || 0)}</TableCell>
            <TableCell>{formatNumber(record.purchases)}</TableCell>
            <TableCell>{formatCurrency(record.revenue)}</TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/50 font-bold border-t-2">
          <TableCell>סה"כ</TableCell>
          <TableCell>{formatNumber(totals.impressions)}</TableCell>
          <TableCell>{formatNumber(totals.addToCart || 0)}</TableCell>
          <TableCell>{formatNumber(totals.purchases)}</TableCell>
          <TableCell>{formatCurrency(totals.revenue)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

// Client Table Card Component
function ClientTableCard({ data }: { data: ClientTableData }) {
  const platformConfig = PLATFORM_CONFIG[data.integrationType];
  const isAnalytics = isAnalyticsPlatform(data.integrationType);
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Badge variant="outline" className="font-semibold text-base">
              {data.clientName}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {getIntegrationIcon(data.integrationType)}
            <span className={`font-medium ${platformConfig?.color || ''}`}>
              {platformConfig?.name || data.integrationType}
            </span>
            {!isAnalytics && (
              <Badge variant="secondary" className="text-xs">
                {data.campaignType === 'leads' ? 'לידים' : 'איקומרס'}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          {isAnalytics ? (
            <AnalyticsTable records={data.records} totals={data.totals} />
          ) : data.campaignType === 'leads' ? (
            <LeadsTable records={data.records} totals={data.totals} />
          ) : (
            <EcommerceTable records={data.records} totals={data.totals} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function AgencyDashboardContent({ agencyId, agencyName, dateFilter }: AgencyDashboardContentProps) {
  const [mainTab, setMainTab] = useState<'performance' | 'crm'>('performance');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const { tenantId } = useCurrentTenant();
  const { isCampaigner, isOwner, isTeamManager, isSuperAdmin, campaignerId } = useUserRole();
  const isRestrictedCampaigner = isCampaigner && !isOwner && !isTeamManager && !isSuperAdmin;
  const [commModal, setCommModal] = useState<{ clientId: string; clientName: string } | null>(null);
  const [seoModal, setSeoModal] = useState<{ clientId: string; clientName: string } | null>(null);
  const [editingClient, setEditingClient] = useState<any>(null);

  // For campaigners: fetch their assigned client IDs (visibility restricted to these clients only)
  const { data: assignedClientIds } = useQuery({
    queryKey: ['campaigner-assigned-client-ids', campaignerId],
    queryFn: async () => {
      if (!campaignerId) return [];
      const { data, error } = await supabase
        .from('client_team')
        .select('client_id')
        .eq('campaigner_id', campaignerId);
      if (error) throw error;
      return data?.map((ct: any) => ct.client_id) || [];
    },
    enabled: !!campaignerId && isRestrictedCampaigner,
  });

  // Fetch clients for this agency — base query (id + name only, safe without migration)
  const { data: clients = [], isLoading: clientsLoading } = useQuery({
    queryKey: ['clients-agency', agencyId, isRestrictedCampaigner ? assignedClientIds : null],
    queryFn: async () => {
      if (isRestrictedCampaigner) {
        if (!assignedClientIds || assignedClientIds.length === 0) return [];
      }
      let query = supabase
        .from('clients')
        .select('id, name')
        .eq('agency_id', agencyId)
        .eq('status', 'active');
      if (isRestrictedCampaigner && assignedClientIds) {
        query = query.in('id', assignedClientIds);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!agencyId && (!isRestrictedCampaigner || !!assignedClientIds),
  });

  const clientIds = clients.map((c: any) => c.id);

  // CRM: fetch extended client fields (tier, services, mood_status) — only when CRM tab active
  // These columns may not exist yet if migration hasn't run; errors are silently ignored.
  const { data: crmClientFields = [] } = useQuery({
    queryKey: ['clients-crm-fields', agencyId, isRestrictedCampaigner ? assignedClientIds : null],
    queryFn: async () => {
      try {
        if (isRestrictedCampaigner) {
          if (!assignedClientIds || assignedClientIds.length === 0) return [];
        }
        let query = supabase
          .from('clients')
          .select('id, tier, services, mood_status')
          .eq('agency_id', agencyId)
          .eq('status', 'active');
        if (isRestrictedCampaigner && assignedClientIds) {
          query = query.in('id', assignedClientIds);
        }
        const { data, error } = await query;
        if (error) return []; // columns may not exist yet — return empty gracefully
        return data || [];
      } catch {
        return [];
      }
    },
    enabled: !!agencyId && mainTab === 'crm' && (!isRestrictedCampaigner || !!assignedClientIds),
    staleTime: 60_000,
  });

  // CRM: fetch communication logs (only when CRM tab is active)
  const { data: commLogs = [] } = useQuery({
    queryKey: ['comm-logs-agency', agencyId, clientIds.join(',')],
    queryFn: async () => {
      if (!clientIds.length || !tenantId) return [];
      const { data, error } = await (supabase as any)
        .from('communication_logs')
        .select('client_id, status, created_at')
        .in('client_id', clientIds)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: clientIds.length > 0 && !!tenantId && mainTab === 'crm',
  });

  // CRM: fetch SEO history (only when CRM tab is active)
  const { data: seoUpdates = [] } = useQuery({
    queryKey: ['seo-agency', agencyId, clientIds.join(',')],
    queryFn: async () => {
      if (!clientIds.length || !tenantId) return [];
      const { data, error } = await (supabase as any)
        .from('seo_monthly_updates')
        .select('client_id, month, status')
        .in('client_id', clientIds)
        .eq('tenant_id', tenantId)
        .order('month', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: clientIds.length > 0 && !!tenantId && mainTab === 'crm',
  });

  // CRM: build enriched rows sorted worst first
  // Merges base client (id, name) with extended CRM fields (tier, services, mood_status)
  // Extended fields fall back to null/empty if migration hasn't run yet
  const crmRows = useMemo(() => {
    return clients.map((c: any) => {
      // Merge extended CRM fields if available
      const ext = (crmClientFields.find((f: any) => f.id === c.id) ?? {}) as CRMClientFields;
      const merged = {
        ...c,
        tier: ext.tier ?? null,
        services: ext.services ?? [],
        mood_status: ext.mood_status ?? null,
      };

      const latestComm = commLogs.find((l: any) => l.client_id === c.id) ?? null;
      const daysSinceComm = latestComm ? differenceInDays(new Date(), new Date(latestComm.created_at)) : null;
      const seoHistory = seoUpdates
        .filter((s: any) => s.client_id === c.id)
        .slice(0, 3)
        .map((s: any) => s.status as 'up' | 'stable' | 'down');
      const result = calculateHealthScore({
        communicationStatus: latestComm?.status ?? merged.mood_status ?? null,
        daysSinceLastCommunication: daysSinceComm,
        services: merged.services,
        performanceChangePct: null,
        daysSinceLastCampaignTouch: null,
        seoHistory,
      });
      const effectiveStatus = getEffectiveStatus(result);
      return {
        ...merged,
        score: result.score,
        overallStatus: result.status,
        effectiveStatus,
        flags: result.flags,
        daysSinceComm,
        lastCommDate: latestComm?.created_at ?? null,
        communicationStatus: latestComm?.status ?? merged.mood_status ?? null,
      };
    }).sort((a: any, b: any) => a.score - b.score);
  }, [clients, crmClientFields, commLogs, seoUpdates]);

  // Fetch all tables for these clients
  const { data: tables = [], isLoading: tablesLoading } = useQuery({
    queryKey: ['crm-tables-agency', agencyId, clients.map(c => c.id).join(',')],
    queryFn: async () => {
      if (clients.length === 0) return [];
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('crm-tables', {
        method: 'GET',
      });

      if (response.error) throw response.error;
      const allTables = Array.isArray(response.data) ? response.data : [];
      
      const clientIds = clients.map(c => c.id);
      return allTables.filter((t: any) => 
        t.client_id && clientIds.includes(t.client_id) &&
        ['facebook_insights', 'facebook_ecommerce', 'google_ads'].includes(t.integration_type)
      );
    },
    enabled: clients.length > 0,
  });

  // Fetch records for all tables
  const { data: allRecords = [], isLoading: recordsLoading } = useQuery({
    queryKey: ['crm-records-agency-dashboard', tables.map((t: any) => t.id).join(','), dateFilter],
    queryFn: async () => {
      if (tables.length === 0) return [];
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Deduplicate Facebook: per client, if both facebook_insights AND facebook_ecommerce exist,
      // skip facebook_insights to avoid double-counting spend/impressions/clicks
      const clientFbTypes = new Map<string, Set<string>>();
      tables.forEach((t: any) => {
        if (isFacebookPlatform(t.integration_type) && t.client_id) {
          if (!clientFbTypes.has(t.client_id)) clientFbTypes.set(t.client_id, new Set());
          clientFbTypes.get(t.client_id)!.add(t.integration_type);
        }
      });
      const skipTableIds = new Set<string>();
      tables.forEach((t: any) => {
        if (t.integration_type === 'facebook_insights' && t.client_id) {
          const types = clientFbTypes.get(t.client_id);
          if (types && types.has('facebook_ecommerce')) {
            skipTableIds.add(t.id);
          }
        }
      });

      const tablesToFetch = tables.filter((t: any) => !skipTableIds.has(t.id));

      const recordsPromises = tablesToFetch.map(async (table: any) => {
        const params = new URLSearchParams({
          table_id: table.id,
          date_filter: dateFilter,
        });
        const response = await supabase.functions.invoke(`crm-records?${params.toString()}`, {
          method: 'GET',
        });
        
        if (response.error) {
          console.error('Error fetching records for table', table.id, response.error);
          return [];
        }
        
        const records = Array.isArray(response.data) ? response.data : [];
        return records.map((r: any) => ({
          ...r,
          _tableId: table.id,
          _tableName: table.name,
          _integrationType: table.integration_type,
          _integrationSettings: table.integration_settings,
          _clientId: table.client_id,
        }));
      });

      const allResults = await Promise.all(recordsPromises);
      return allResults.flat();
    },
    enabled: tables.length > 0,
    placeholderData: (previousData) => previousData,
  });

  // Determine which platforms exist for tab display
  const availablePlatforms = useMemo(() => {
    const platforms = new Set<string>();
    tables.forEach((t: any) => platforms.add(t.integration_type));
    return {
      hasFacebook: Array.from(platforms).some(p => isFacebookPlatform(p)),
      hasGoogleAds: platforms.has('google_ads'),
      hasAnalytics: platforms.has('google_analytics'),
    };
  }, [tables]);

  // Group data by client and table with campaign-level detail
  const clientTableDataList = useMemo(() => {
    const clientMap = new Map(clients.map(c => [c.id, c.name]));
    const tableDataMap = new Map<string, ClientTableData>();

    allRecords.forEach((record: any) => {
      const tableId = record._tableId;
      const clientId = record._clientId;
      const integrationType = record._integrationType;
      const integrationSettings = record._integrationSettings;
      
      if (!tableId || !clientId) return;
      // Apply platform filter
      if (!matchesPlatformFilter(integrationType, platformFilter)) return;

      const key = `${clientId}-${tableId}`;
      
      if (!tableDataMap.has(key)) {
        tableDataMap.set(key, {
          clientId,
          clientName: clientMap.get(clientId) || 'לקוח לא ידוע',
          tableId,
          tableName: record._tableName,
          integrationType,
          campaignType: getCampaignType(integrationType, integrationSettings),
          records: [],
          totals: {
            campaignName: 'סה"כ',
            impressions: 0,
            clicks: 0,
            leads: 0,
            purchases: 0,
            spend: 0,
            revenue: 0,
            addToCart: 0,
          },
        });
      }

      const tableData = tableDataMap.get(key)!;
      const data = record.data || {};
      
      // For Analytics, use traffic_source records for table view
      if (isAnalyticsPlatform(integrationType)) {
        if (data.report_type !== 'traffic_source') return;
      }
      
      const campaignName = isAnalyticsPlatform(integrationType) 
        ? (data.source_medium || 'Unknown')
        : (data.campaign_name || data.campaignName || data.name || 'ללא שם');
      
      let campaignRecord = tableData.records.find(r => r.campaignName === campaignName);
      
      if (!campaignRecord) {
        campaignRecord = {
          campaignName,
          impressions: 0,
          clicks: 0,
          leads: 0,
          purchases: 0,
          spend: 0,
          revenue: 0,
          addToCart: 0,
        };
        tableData.records.push(campaignRecord);
      }

      if (isAnalyticsPlatform(integrationType)) {
        const sessions = getSessionsFromData(data);
        const purchases = getPurchasesFromData(data);
        const revenue = getRevenueFromData(data);
        const addToCart = getAddToCartFromData(data);
        
        campaignRecord.impressions += sessions;
        campaignRecord.purchases += purchases;
        campaignRecord.revenue += revenue;
        campaignRecord.addToCart = (campaignRecord.addToCart || 0) + addToCart;
        
        tableData.totals.impressions += sessions;
        tableData.totals.purchases += purchases;
        tableData.totals.revenue += revenue;
        tableData.totals.addToCart = (tableData.totals.addToCart || 0) + addToCart;
      } else {
        const impressions = Number(data.impressions) || 0;
        const clicks = Number(data.clicks) || 0;
        const leads = getLeadsFromData(data);
        const purchases = getPurchasesFromData(data);
        const spend = getSpendFromData(data);
        const revenue = getRevenueFromData(data);

        campaignRecord.impressions += impressions;
        campaignRecord.clicks += clicks;
        campaignRecord.leads += leads;
        campaignRecord.purchases += purchases;
        campaignRecord.spend += spend;
        campaignRecord.revenue += revenue;

        tableData.totals.impressions += impressions;
        tableData.totals.clicks += clicks;
        tableData.totals.leads += leads;
        tableData.totals.purchases += purchases;
        tableData.totals.spend += spend;
        tableData.totals.revenue += revenue;
      }
    });

    return Array.from(tableDataMap.values())
      .filter(d => d.records.length > 0)
      .sort((a, b) => a.clientName.localeCompare(b.clientName, 'he'));
  }, [clients, allRecords, platformFilter]);

  // Build daily chart data - uses daily records from Analytics
  const dailyChartData = useMemo(() => {
    const byDate: Record<string, { 
      date: string; adsSpend: number; analyticsRevenue: number; 
      analyticsPurchases: number; analyticsAddToCart: number;
      analyticsSessions: number; adsLeads: number;
      fbSpend: number; gaSpend: number;
    }> = {};

    allRecords.forEach((record: any) => {
      const data = record.data || {};
      const date = data.date;
      if (!date) return;
      
      const integrationType = record._integrationType;
      // Apply platform filter to charts too
      if (!matchesPlatformFilter(integrationType, platformFilter)) return;
      
      if (!byDate[date]) {
        byDate[date] = { 
          date, adsSpend: 0, analyticsRevenue: 0, 
          analyticsPurchases: 0, analyticsAddToCart: 0,
          analyticsSessions: 0, adsLeads: 0,
          fbSpend: 0, gaSpend: 0,
        };
      }
      
      if (isAnalyticsPlatform(integrationType)) {
        if (data.report_type === 'daily') {
          byDate[date].analyticsRevenue += getRevenueFromData(data);
          byDate[date].analyticsPurchases += getPurchasesFromData(data);
          byDate[date].analyticsAddToCart += getAddToCartFromData(data);
          byDate[date].analyticsSessions += getSessionsFromData(data);
        }
      } else if (isAdsPlatform(integrationType)) {
        const spend = getSpendFromData(data);
        byDate[date].adsSpend += spend;
        byDate[date].adsLeads += getLeadsFromData(data);
        if (isFacebookPlatform(integrationType)) byDate[date].fbSpend += spend;
        if (isGoogleAdsPlatform(integrationType)) byDate[date].gaSpend += spend;
      }
    });

    return Object.values(byDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(d => ({
        ...d,
        dateLabel: new Date(d.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }),
        roas: d.adsSpend > 0 ? +(d.analyticsRevenue / d.adsSpend).toFixed(2) : 0,
      }));
  }, [allRecords, platformFilter]);

  // Calculate overall totals
  const overallTotals = useMemo(() => {
    let adsSpend = 0;
    let adsLeads = 0;
    let adsPurchases = 0;
    let analyticsRevenue = 0;
    let analyticsPurchases = 0;
    let analyticsSessions = 0;
    let analyticsAddToCart = 0;

    clientTableDataList.forEach((data) => {
      if (isAnalyticsPlatform(data.integrationType)) {
        analyticsRevenue += data.totals.revenue;
        analyticsPurchases += data.totals.purchases;
        analyticsSessions += data.totals.impressions;
        analyticsAddToCart += (data.totals.addToCart || 0);
      } else if (isAdsPlatform(data.integrationType)) {
        adsSpend += data.totals.spend;
        adsLeads += data.totals.leads;
        adsPurchases += data.totals.purchases;
      }
    });

    // Also aggregate from daily records for Analytics totals (more accurate with date filtering)
    // traffic_source records don't have dates, so they aren't date-filtered.
    // Daily records DO have dates. Use daily totals when available.
    let dailyAnalyticsRevenue = 0;
    let dailyAnalyticsPurchases = 0;
    let dailyAnalyticsSessions = 0;
    let dailyAnalyticsAddToCart = 0;
    let hasDailyData = false;

    allRecords.forEach((record: any) => {
      const data = record.data || {};
      const integrationType = record._integrationType;
      if (!isAnalyticsPlatform(integrationType)) return;
      if (!matchesPlatformFilter(integrationType, platformFilter)) return;
      if (data.report_type === 'daily' && data.date) {
        hasDailyData = true;
        dailyAnalyticsRevenue += getRevenueFromData(data);
        dailyAnalyticsPurchases += getPurchasesFromData(data);
        dailyAnalyticsSessions += getSessionsFromData(data);
        dailyAnalyticsAddToCart += getAddToCartFromData(data);
      }
    });

    // If we have daily data, prefer it (it respects date filtering)
    if (hasDailyData) {
      analyticsRevenue = dailyAnalyticsRevenue;
      analyticsPurchases = dailyAnalyticsPurchases;
      analyticsSessions = dailyAnalyticsSessions;
      analyticsAddToCart = dailyAnalyticsAddToCart;
    }

    return { adsSpend, adsLeads, adsPurchases, analyticsRevenue, analyticsPurchases, analyticsSessions, analyticsAddToCart };
  }, [clientTableDataList, allRecords, platformFilter]);

  const hasAnalyticsData = availablePlatforms.hasAnalytics;
  const showAnalyticsMetrics = platformFilter === 'all' || platformFilter === 'google_analytics';
  const showAdsMetrics = platformFilter === 'facebook' || platformFilter === 'google_ads';
  
  const combinedRoas = overallTotals.adsSpend > 0 ? overallTotals.analyticsRevenue / overallTotals.adsSpend : 0;
  const totalCPL = overallTotals.adsLeads > 0 ? overallTotals.adsSpend / overallTotals.adsLeads : 0;

  const isLoading = clientsLoading || tablesLoading || recordsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <Card className="p-12 text-center">
        <h3 className="text-lg font-semibold mb-2">אין לקוחות פעילים בסוכנות זו</h3>
        <p className="text-muted-foreground">הוסף לקוחות פעילים לסוכנות כדי לראות נתונים בדשבורד</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Main Tab: Performance vs CRM */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as 'performance' | 'crm')}>
        <TabsList className="mb-4">
          <TabsTrigger value="performance" className="gap-2">
            <Activity className="h-4 w-4" />
            ביצועים
          </TabsTrigger>
          <TabsTrigger value="crm" className="gap-2">
            🏢 CRM לקוחות
          </TabsTrigger>
        </TabsList>

        {/* ── CRM Tab ── */}
        <TabsContent value="crm">
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              {(['red', 'yellow', 'green'] as OverallStatus[]).map((s) => {
                const count = crmRows.filter((r: any) => r.effectiveStatus === s).length;
                const cfg = OVERALL_STATUS_CONFIG[s];
                return (
                  <Card key={s} className="p-4 flex items-center gap-3">
                    <span className="text-2xl">{cfg.dot}</span>
                    <div>
                      <p className="text-xl font-bold">{count}</p>
                      <p className="text-xs text-muted-foreground">{cfg.label}</p>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* CRM Table */}
            <Card>
              <CardContent className="p-0">
                <Table dir="rtl">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right w-8">סטטוס</TableHead>
                      <TableHead className="text-right">לקוח</TableHead>
                      <TableHead className="text-right w-16">ציון</TableHead>
                      <TableHead className="text-right">Flags</TableHead>
                       <TableHead className="text-right">בדיקת דופק</TableHead>
                       <TableHead className="text-right">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {crmRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          אין לקוחות להצגה
                        </TableCell>
                      </TableRow>
                    ) : (
                      crmRows.map((client: any) => (
                        <TableRow
                          key={client.id}
                          className={
                            client.effectiveStatus === 'red' ? 'bg-red-50/40' :
                            client.effectiveStatus === 'yellow' ? 'bg-yellow-50/30' : ''
                          }
                        >
                          <TableCell className="text-center">
                            <TooltipProvider>
                              <UITooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-xl cursor-default">
                                    {OVERALL_STATUS_CONFIG[client.effectiveStatus as OverallStatus]?.dot}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {OVERALL_STATUS_CONFIG[client.effectiveStatus as OverallStatus]?.label}
                                </TooltipContent>
                              </UITooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{client.name}</span>
                              {client.tier && (
                                <Badge variant="outline" className={`text-xs px-1.5 ${TIER_COLORS[client.tier] || ''}`}>
                                  {client.tier}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`font-bold ${
                                client.effectiveStatus === 'green' ? 'bg-green-100 text-green-800 border-green-300' :
                                client.effectiveStatus === 'yellow' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' :
                                'bg-red-100 text-red-800 border-red-300'
                              }`}
                            >
                              {client.score}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[220px]">
                              {(client.flags as FlagKey[]).slice(0, 3).map((flag: FlagKey) => (
                                <Badge key={flag} variant="outline" className={`text-xs ${FLAG_COLORS[flag] || ''}`}>
                                  {FLAG_LABELS[flag]}
                                </Badge>
                              ))}
                              {client.flags.length > 3 && (
                                <Badge variant="outline" className="text-xs">+{client.flags.length - 3}</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {client.lastCommDate ? (
                              <span className="text-xs text-muted-foreground">
                                {client.daysSinceComm === 0 ? 'היום' : `לפני ${client.daysSinceComm} ימים`}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <TooltipProvider>
                                <UITooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline" size="sm" className="h-8 px-2"
                                      onClick={() => setEditingClient(client)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>עריכה ידנית</TooltipContent>
                                </UITooltip>
                              </TooltipProvider>
                              {(client.services ?? []).includes('seo') && (
                                <TooltipProvider>
                                  <UITooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline" size="sm" className="h-8 px-2"
                                        onClick={() => setSeoModal({ clientId: client.id, clientName: client.name })}
                                      >
                                        🔍
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>עדכון SEO</TooltipContent>
                                  </UITooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Performance Tab ── */}
        <TabsContent value="performance">
          <div className="space-y-6">
      {/* Platform Filter Tabs */}
      <Tabs value={platformFilter} onValueChange={(v) => setPlatformFilter(v as PlatformFilter)} dir="rtl">
        <TabsList className="h-auto flex-wrap gap-1">
          <TabsTrigger value="all" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            הכל
          </TabsTrigger>
          {availablePlatforms.hasFacebook && (
            <TabsTrigger value="facebook" className="gap-2">
              <Facebook className="h-4 w-4 text-blue-600" />
              Facebook
            </TabsTrigger>
          )}
          {availablePlatforms.hasGoogleAds && (
            <TabsTrigger value="google_ads" className="gap-2">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
                <path d="M3.654 14.916l6.26-10.857c.68-1.18 2.184-1.59 3.361-.916l.004.003c1.178.68 1.586 2.184.909 3.361l-6.26 10.857c-.68 1.18-2.184 1.59-3.361.916l-.004-.003c-1.178-.68-1.586-2.184-.909-3.361z" fill="#FBBC04"/>
                <path d="M14.088 14.916l6.26-10.857c.68-1.18.27-2.684-.909-3.361l-.004-.003c-1.177-.674-2.681-.264-3.361.916l-6.26 10.857c-.68 1.18-.27 2.684.909 3.361l.004.003c1.177.674 2.681.264 3.361-.916z" fill="#4285F4"/>
                <circle cx="6" cy="18" r="3.5" fill="#34A853"/>
              </svg>
              Google Ads
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      {/* Summary Cards - ads platforms only (no analytics, no combined totals) */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {showAdsMetrics && (
          <>
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">הוצאת פרסום</p>
                <p className="text-3xl font-bold mt-2">{formatCurrency(overallTotals.adsSpend)}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">לידים</p>
                <p className="text-3xl font-bold mt-2">{formatNumber(overallTotals.adsLeads)}</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground">עלות לליד (CPL)</p>
                <p className="text-3xl font-bold mt-2">{formatCurrency(totalCPL)}</p>
              </CardContent>
            </Card>
          </>
        )}

      </div>

      {/* Daily Charts */}
      {dailyChartData.length > 0 && (
        <>

          {/* Ads spend chart - for ads platform tabs or "all" */}
          {(platformFilter === 'facebook' || platformFilter === 'google_ads') && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">הוצאות פרסום - יומי</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={dailyChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="dateLabel" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'הוצאה']}
                      labelFormatter={(label) => `תאריך: ${label}`}
                    />
                    <Bar dataKey="adsSpend" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}


      {/* Client Cards */}
      {clientTableDataList.length === 0 ? (
        <Card className="p-12 text-center">
          <h3 className="text-lg font-semibold mb-2">אין נתונים להצגה</h3>
          <p className="text-muted-foreground">אין נתונים לפלטפורמה הנבחרת בטווח התאריכים הנוכחי</p>
        </Card>
      ) : (
        clientTableDataList.map((data) => (
          <ClientTableCard key={`${data.clientId}-${data.tableId}`} data={data} />
        ))
      )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {seoModal && (
        <SeoUpdateModal
          clientId={seoModal.clientId}
          clientName={seoModal.clientName}
          open={!!seoModal}
          onOpenChange={(open) => !open && setSeoModal(null)}
        />
      )}
      {editingClient && (
        <ManualHealthEditDialog
          open={!!editingClient}
          onOpenChange={(open) => { if (!open) setEditingClient(null); }}
          clientId={editingClient.id}
          clientName={editingClient.name}
          currentScore={editingClient.score}
          currentFlags={editingClient.flags}
          currentMood={editingClient.mood_status}
          onSaved={() => {}}
        />
      )}
    </div>
  );
}
