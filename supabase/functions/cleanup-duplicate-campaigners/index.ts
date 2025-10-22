import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting cleanup of duplicate campaigners...');

    // IDs to delete (duplicates)
    const duplicateIds = [
      '26221b44-e119-47e7-9a53-6d1f2b21aad7', // davi
      'e9eb9548-796b-4309-82b3-a9463539dea8', // david
      '5affb462-0c76-43e2-bf05-68108cae9eaa', // david
      'f8e135b8-f5a1-4f9a-86e2-88cd4cdfd633', // david
      '07e7a1af-96a8-4299-9c6d-fbc6cbaae169', // david
      'd64c6a93-4eae-4ad4-a1d7-aca322ce4d9b', // david
      '219de20a-88d6-4bb9-866c-0fea0734ebc6', // david
      '3041ce8f-8b82-41dd-9537-03864f187de5', // david
      '24f453bf-3f14-4822-9647-6b636e2f4717', // david
      '5520eb01-ac7f-4196-8b73-a4dc84e6a7a4', // david.dmm4business
    ];

    // Keep these:
    // - a3ab197e-28d3-4204-bf18-dfffc1f3526c (david - linked to user)
    // - e2fd8806-305b-48b2-9fa5-9da1f35fcc28 (דוד קסטלנואובו)

    // Delete duplicates
    const { data: deletedRecords, error: deleteError } = await supabase
      .from('campaigners')
      .delete()
      .in('id', duplicateIds)
      .select();

    if (deleteError) {
      console.error('Error deleting duplicates:', deleteError);
      throw deleteError;
    }

    console.log(`Successfully deleted ${deletedRecords?.length || 0} duplicate campaigners`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Deleted ${deletedRecords?.length || 0} duplicate campaigners`,
        deleted: deletedRecords,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in cleanup-duplicate-campaigners:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

