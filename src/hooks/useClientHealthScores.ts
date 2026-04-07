/**
 * useClientHealthScores
 *
 * Fetches communication_logs and seo_monthly_updates for a list of clients,
 * then computes health scores client-side using calculateHealthScore().
 *
 * Performance data (ads) is passed in from the caller (already fetched from
 * the existing crm_records / dynamic-tables pipeline).
 */

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculateHealthScore, HealthInput, HealthResult } from '@/lib/healthScore';
import { differenceInDays } from 'date-fns';

export interface ClientPerformanceData {
  clientId: string;
  /** % change: negative = drop. null = no data */
  performanceChangePct: number | null;
  /** Days since last campaign was edited/touched. null = unknown */
  daysSinceLastCampaignTouch: number | null;
}

export interface ClientHealthScore extends HealthResult {
  clientId: string;
}

export function useClientHealthScores(
  clientIds: string[],
  tenantId: string | null,
  performanceData: ClientPerformanceData[] = []
) {
  // ── Fetch latest communication log per client ──────────────
  const { data: commLogs = [] } = useQuery({
    queryKey: ['communication-logs-latest', clientIds.join(','), tenantId],
    queryFn: async () => {
      if (!clientIds.length || !tenantId) return [];
      const { data, error } = await supabase
        .from('communication_logs')
        .select('client_id, status, created_at')
        .in('client_id', clientIds)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: clientIds.length > 0 && !!tenantId,
    staleTime: 60_000,
  });

  // ── Fetch last 3 SEO entries per client ───────────────────
  const { data: seoUpdates = [] } = useQuery({
    queryKey: ['seo-monthly-latest', clientIds.join(','), tenantId],
    queryFn: async () => {
      if (!clientIds.length || !tenantId) return [];
      const { data, error } = await supabase
        .from('seo_monthly_updates')
        .select('client_id, month, status')
        .in('client_id', clientIds)
        .eq('tenant_id', tenantId)
        .order('month', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: clientIds.length > 0 && !!tenantId,
    staleTime: 60_000,
  });

  // ── Build per-client health scores ────────────────────────
  const scores: Record<string, ClientHealthScore> = {};

  for (const clientId of clientIds) {
    // Latest communication log
    const latestComm = commLogs.find((l: any) => l.client_id === clientId);
    const daysSinceComm = latestComm
      ? differenceInDays(new Date(), new Date(latestComm.created_at))
      : null;

    // SEO history (last 3 months)
    const seoHistory = seoUpdates
      .filter((s: any) => s.client_id === clientId)
      .slice(0, 3)
      .map((s: any) => s.status as 'up' | 'stable' | 'down');

    // Performance data from caller
    const perf = performanceData.find((p) => p.clientId === clientId);

    const input: HealthInput = {
      communicationStatus: latestComm?.status ?? null,
      daysSinceLastCommunication: daysSinceComm,
      services: [], // caller should enrich via client.services
      performanceChangePct: perf?.performanceChangePct ?? null,
      daysSinceLastCampaignTouch: perf?.daysSinceLastCampaignTouch ?? null,
      seoHistory,
    };

    const result = calculateHealthScore(input);
    scores[clientId] = { clientId, ...result };
  }

  return scores;
}

/**
 * useClientHealthScore — single client variant
 */
export function useClientHealthScore(
  clientId: string,
  tenantId: string | null,
  services: string[],
  performanceChangePct: number | null = null,
  daysSinceLastCampaignTouch: number | null = null
): HealthResult | null {
  const { data: commLogs = [] } = useQuery({
    queryKey: ['communication-logs-single', clientId, tenantId],
    queryFn: async () => {
      if (!clientId || !tenantId) return [];
      const { data, error } = await supabase
        .from('communication_logs')
        .select('client_id, status, created_at')
        .eq('client_id', clientId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clientId && !!tenantId,
    staleTime: 30_000,
  });

  const { data: seoUpdates = [] } = useQuery({
    queryKey: ['seo-monthly-single', clientId, tenantId],
    queryFn: async () => {
      if (!clientId || !tenantId) return [];
      const { data, error } = await supabase
        .from('seo_monthly_updates')
        .select('client_id, month, status')
        .eq('client_id', clientId)
        .eq('tenant_id', tenantId)
        .order('month', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!clientId && !!tenantId,
    staleTime: 30_000,
  });

  const latestComm = commLogs[0] ?? null;
  const daysSinceComm = latestComm
    ? differenceInDays(new Date(), new Date(latestComm.created_at))
    : null;

  const seoHistory = seoUpdates.map((s: any) => s.status as 'up' | 'stable' | 'down');

  const input: HealthInput = {
    communicationStatus: latestComm?.status ?? null,
    daysSinceLastCommunication: daysSinceComm,
    services,
    performanceChangePct,
    daysSinceLastCampaignTouch,
    seoHistory,
  };

  return calculateHealthScore(input);
}
