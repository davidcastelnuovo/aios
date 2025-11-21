import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useIntegrationPermissions(integrationId: string | undefined) {
  const queryClient = useQueryClient();

  // Fetch permissions for an integration
  const { data: permissions, isLoading } = useQuery({
    queryKey: ['integration-permissions', integrationId],
    queryFn: async () => {
      if (!integrationId) return [];
      
      // First get the permissions
      const { data: permData, error: permError } = await supabase
        .from('integration_user_permissions')
        .select('*')
        .eq('integration_id', integrationId);
      
      if (permError) throw permError;
      if (!permData || permData.length === 0) return [];
      
      // Then get the profiles for those users
      const userIds = permData.map(p => p.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      
      if (profilesError) throw profilesError;
      
      // Combine the data
      return permData.map(perm => ({
        ...perm,
        profiles: profiles?.find(p => p.id === perm.user_id) || null
      }));
    },
    enabled: !!integrationId,
  });

  // Grant permission mutation
  const grantPermission = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      if (!integrationId) throw new Error('No integration ID');
      
      const { error } = await supabase
        .from('integration_user_permissions')
        .insert({
          integration_id: integrationId,
          user_id: userId,
          granted_by: (await supabase.auth.getUser()).data.user?.id,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-permissions', integrationId] });
      toast.success('ההרשאה נוספה בהצלחה');
    },
    onError: (error: any) => {
      console.error('Grant permission error:', error);
      toast.error('שגיאה במתן הרשאה');
    },
  });

  // Revoke permission mutation
  const revokePermission = useMutation({
    mutationFn: async ({ userId }: { userId: string }) => {
      if (!integrationId) throw new Error('No integration ID');
      
      const { error } = await supabase
        .from('integration_user_permissions')
        .delete()
        .eq('integration_id', integrationId)
        .eq('user_id', userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-permissions', integrationId] });
      toast.success('ההרשאה נשללה בהצלחה');
    },
    onError: (error: any) => {
      console.error('Revoke permission error:', error);
      toast.error('שגיאה בשלילת הרשאה');
    },
  });

  // Check if user has permission
  const checkPermission = async (userId: string): Promise<boolean> => {
    if (!integrationId) return false;
    
    const { data } = await supabase.rpc('user_has_integration_permission', {
      p_user_id: userId,
      p_integration_id: integrationId,
    });
    
    return data || false;
  };

  return {
    permissions,
    isLoading,
    grantPermission,
    revokePermission,
    checkPermission,
  };
}