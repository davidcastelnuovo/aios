import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentTenant } from "./useCurrentTenant";

type EntityType = 'task' | 'client' | 'lead';

export function useCustomFieldLabels(entityType: EntityType) {
  const { tenantId } = useCurrentTenant();

  const { data: fieldLabels, isLoading } = useQuery({
    queryKey: ['custom-field-labels', tenantId, entityType],
    queryFn: async () => {
      if (!tenantId) return {};
      
      const { data, error } = await supabase
        .from('custom_fields')
        .select('field_key, field_label')
        .eq('tenant_id', tenantId)
        .eq('entity_type', entityType);

      if (error) throw error;
      
      // Convert to a map for easy lookup
      const labelsMap: Record<string, string> = {};
      data?.forEach(field => {
        labelsMap[field.field_key] = field.field_label;
      });
      
      return labelsMap;
    },
    enabled: !!tenantId,
  });

  const getFieldLabel = (fieldKey: string, fallback: string = fieldKey) => {
    return fieldLabels?.[fieldKey] || fallback;
  };

  return {
    fieldLabels: fieldLabels || {},
    getFieldLabel,
    isLoading,
  };
}
