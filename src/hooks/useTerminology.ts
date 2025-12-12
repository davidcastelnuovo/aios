import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "./useCurrentTenant";

// Default terminology fallback
const DEFAULT_TERMS: Record<string, { singular: string; plural: string }> = {
  // Module names
  agency: { singular: 'סוכנות', plural: 'סוכנויות' },
  client: { singular: 'לקוח', plural: 'לקוחות' },
  lead: { singular: 'ליד', plural: 'לידים' },
  task: { singular: 'משימה', plural: 'משימות' },
  campaigner: { singular: 'קמפיינר', plural: 'קמפיינרים' },
  sales_person: { singular: 'איש מכירות', plural: 'אנשי מכירות' },
  supplier: { singular: 'ספק', plural: 'ספקים' },
  product: { singular: 'מוצר', plural: 'מוצרים' },
  onboarding: { singular: 'קליטה', plural: 'קליטות' },
  // Role names
  role_owner: { singular: 'בעלים', plural: 'בעלים' },
  role_team_manager: { singular: 'מנהל צוות', plural: 'מנהלי צוות' },
  role_campaigner: { singular: 'קמפיינר', plural: 'קמפיינרים' },
  role_sales_person: { singular: 'איש מכירות', plural: 'אנשי מכירות' },
  role_seo: { singular: 'SEO', plural: 'SEO' },
  role_super_admin: { singular: 'סופר אדמין', plural: 'סופר אדמינים' },
};

export function useTerminology() {
  const { tenantId } = useCurrentTenant();

  const { data: terms, isLoading } = useQuery({
    queryKey: ['terminology', tenantId],
    queryFn: async () => {
      if (!tenantId) return {};
      
      const { data, error } = await supabase
        .from('tenant_terminology' as any)
        .select('term_key, singular, plural')
        .eq('tenant_id', tenantId);

      if (error) throw error;
      
      // Convert to map for easy lookup
      const termsMap: Record<string, { singular: string; plural: string }> = {};
      (data as any)?.forEach((term: any) => {
        termsMap[term.term_key] = {
          singular: term.singular,
          plural: term.plural,
        };
      });
      
      return termsMap;
    },
    enabled: !!tenantId,
  });

  /**
   * Get term by key
   * @param key - The term key (e.g., 'agency', 'client')
   * @param isPlural - Whether to return plural form
   * @returns The localized term
   */
  const t = (key: string, isPlural: boolean = false): string => {
    const term = terms?.[key] || DEFAULT_TERMS[key];
    if (!term) return key; // Fallback to key if not found
    return isPlural ? term.plural : term.singular;
  };

  return {
    t,
    terms: terms || {},
    isLoading,
  };
}
