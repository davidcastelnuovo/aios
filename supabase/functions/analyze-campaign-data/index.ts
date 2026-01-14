import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EventPeriod {
  eventDate: string;
  startDate: string;
  endDate: string;
  metrics: {
    totalSpend: number;
    totalLeads: number;
    avgCostPerLead: number;
    avgCtr: number;
    avgCpm: number;
    totalClicks: number;
    totalImpressions: number;
    campaigns: string[];
  };
}

interface CampaignPeriodData {
  campaignName: string;
  eventDate: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  leads: number;
  costPerLead: number;
  lpViews: number;
  lpConversionRate: number;
  spend: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tableId, eventDates, daysBeforeEvent = 7, campaignFilter, analysisType = 'comparison', customInstructions } = await req.json();

    if (!tableId || !eventDates || eventDates.length === 0) {
      return new Response(
        JSON.stringify({ error: 'tableId and eventDates are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch all records for this table
    const { data: records, error: recordsError } = await supabase
      .from('crm_records')
      .select('data')
      .eq('table_id', tableId);

    if (recordsError) {
      console.error('Error fetching records:', recordsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch records' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!records || records.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No records found for this table' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse event dates and calculate periods
    const currentYear = new Date().getFullYear();
    const eventPeriods: EventPeriod[] = [];
    const campaignPeriodData: CampaignPeriodData[] = [];

    for (const dateStr of eventDates) {
      // Parse date in format "D.M" or "DD.MM"
      const parts = dateStr.trim().split('.');
      if (parts.length !== 2) continue;

      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]);
      
      if (isNaN(day) || isNaN(month)) continue;

      // Determine year (if month is in the future, use previous year)
      const currentMonth = new Date().getMonth() + 1;
      const year = month > currentMonth ? currentYear - 1 : currentYear;

      const eventDate = new Date(year, month - 1, day);
      const startDate = new Date(eventDate);
      startDate.setDate(startDate.getDate() - daysBeforeEvent);

      const eventDateStr = eventDate.toISOString().split('T')[0];
      const startDateStr = startDate.toISOString().split('T')[0];
      const eventDateDisplay = `${day}.${month}`;

      // Filter records for this period
      const periodRecords = records.filter(record => {
        const recordDate = record.data?.date;
        if (!recordDate) return false;
        
        // Apply campaign filter if provided
        if (campaignFilter) {
          const campaignName = String(record.data?.campaign_name || '').toLowerCase();
          if (!campaignName.includes(campaignFilter.toLowerCase())) return false;
        }

        return recordDate >= startDateStr && recordDate <= eventDateStr;
      });

      // For raw_table: aggregate by campaign within this period
      if (analysisType === 'raw_table') {
        const campaignMap = new Map<string, {
          impressions: number;
          clicks: number;
          leads: number;
          spend: number;
          lpViews: number;
          ctrSum: number;
          ctrCount: number;
          cpmSum: number;
          cpmCount: number;
        }>();

        for (const record of periodRecords) {
          const data = record.data;
          const campaignName = data?.campaign_name || 'לא צוין';
          
          if (!campaignMap.has(campaignName)) {
            campaignMap.set(campaignName, {
              impressions: 0,
              clicks: 0,
              leads: 0,
              spend: 0,
              lpViews: 0,
              ctrSum: 0,
              ctrCount: 0,
              cpmSum: 0,
              cpmCount: 0,
            });
          }
          
          const campaign = campaignMap.get(campaignName)!;
          campaign.impressions += parseInt(data?.impressions) || 0;
          campaign.clicks += parseInt(data?.clicks) || 0;
          campaign.leads += parseInt(data?.leads) || 0;
          campaign.spend += parseFloat(data?.spend) || 0;
          campaign.lpViews += parseInt(data?.lp_views) || parseInt(data?.landing_page_views) || 0;
          
          if (data?.ctr) {
            campaign.ctrSum += parseFloat(data.ctr);
            campaign.ctrCount++;
          }
          if (data?.cpm) {
            campaign.cpmSum += parseFloat(data.cpm);
            campaign.cpmCount++;
          }
        }

        // Convert to array
        for (const [campaignName, metrics] of campaignMap) {
          const ctr = metrics.clicks > 0 && metrics.impressions > 0 
            ? (metrics.clicks / metrics.impressions) * 100 
            : (metrics.ctrCount > 0 ? metrics.ctrSum / metrics.ctrCount : 0);
          
          const cpc = metrics.clicks > 0 ? metrics.spend / metrics.clicks : 0;
          const cpm = metrics.impressions > 0 
            ? (metrics.spend / metrics.impressions) * 1000 
            : (metrics.cpmCount > 0 ? metrics.cpmSum / metrics.cpmCount : 0);
          
          const costPerLead = metrics.leads > 0 ? metrics.spend / metrics.leads : 0;
          const lpConversionRate = metrics.lpViews > 0 ? (metrics.leads / metrics.lpViews) * 100 : 0;

          campaignPeriodData.push({
            campaignName,
            eventDate: eventDateDisplay,
            impressions: metrics.impressions,
            clicks: metrics.clicks,
            ctr: Math.round(ctr * 100) / 100,
            cpc: Math.round(cpc * 100) / 100,
            cpm: Math.round(cpm * 100) / 100,
            leads: metrics.leads,
            costPerLead: Math.round(costPerLead * 100) / 100,
            lpViews: metrics.lpViews,
            lpConversionRate: Math.round(lpConversionRate * 100) / 100,
            spend: Math.round(metrics.spend * 100) / 100,
          });
        }
      }

      // Calculate aggregate metrics for this period (for all analysis types)
      let totalSpend = 0;
      let totalLeads = 0;
      let totalClicks = 0;
      let totalImpressions = 0;
      let ctrSum = 0;
      let cpmSum = 0;
      let ctrCount = 0;
      let cpmCount = 0;
      const campaigns = new Set<string>();

      for (const record of periodRecords) {
        const data = record.data;
        
        totalSpend += parseFloat(data?.spend) || 0;
        totalLeads += parseInt(data?.leads) || 0;
        totalClicks += parseInt(data?.clicks) || 0;
        totalImpressions += parseInt(data?.impressions) || 0;
        
        if (data?.ctr) {
          ctrSum += parseFloat(data.ctr);
          ctrCount++;
        }
        if (data?.cpm) {
          cpmSum += parseFloat(data.cpm);
          cpmCount++;
        }
        if (data?.campaign_name) {
          campaigns.add(data.campaign_name);
        }
      }

      const avgCostPerLead = totalLeads > 0 ? totalSpend / totalLeads : 0;
      const avgCtr = ctrCount > 0 ? ctrSum / ctrCount : 0;
      const avgCpm = cpmCount > 0 ? cpmSum / cpmCount : 0;

      eventPeriods.push({
        eventDate: eventDateDisplay,
        startDate: startDateStr,
        endDate: eventDateStr,
        metrics: {
          totalSpend: Math.round(totalSpend * 100) / 100,
          totalLeads,
          avgCostPerLead: Math.round(avgCostPerLead * 100) / 100,
          avgCtr: Math.round(avgCtr * 100) / 100,
          avgCpm: Math.round(avgCpm * 100) / 100,
          totalClicks,
          totalImpressions,
          campaigns: Array.from(campaigns),
        },
      });
    }

    // Sort periods by date (newest first)
    eventPeriods.sort((a, b) => {
      const [dayA, monthA] = a.eventDate.split('.').map(Number);
      const [dayB, monthB] = b.eventDate.split('.').map(Number);
      if (monthA !== monthB) return monthB - monthA;
      return dayB - dayA;
    });

    // For raw_table, return data without AI analysis
    if (analysisType === 'raw_table') {
      // Sort campaign data by event date then campaign name
      campaignPeriodData.sort((a, b) => {
        const [dayA, monthA] = a.eventDate.split('.').map(Number);
        const [dayB, monthB] = b.eventDate.split('.').map(Number);
        if (monthA !== monthB) return monthB - monthA;
        if (dayA !== dayB) return dayB - dayA;
        return a.campaignName.localeCompare(b.campaignName);
      });

      return new Response(
        JSON.stringify({
          success: true,
          periods: eventPeriods,
          campaignData: campaignPeriodData,
          analysisType: 'raw_table',
          daysBeforeEvent,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare prompt for AI
    let analysisPrompt = '';
    
    if (analysisType === 'comparison') {
      analysisPrompt = `אתה אנליסט שיווק דיגיטלי מומחה. קיבלת נתוני קמפיינים של פייסבוק מסביב לאירועים (וובינרים).

**תאריכי האירועים (${daysBeforeEvent} ימים לפני כל אירוע):**
${eventPeriods.map(p => `
📅 **אירוע ${p.eventDate}** (${p.startDate} עד ${p.endDate}):
   - סה"כ הוצאה: ₪${p.metrics.totalSpend.toLocaleString()}
   - סה"כ לידים: ${p.metrics.totalLeads}
   - עלות לליד: ₪${p.metrics.avgCostPerLead}
   - CTR ממוצע: ${p.metrics.avgCtr}%
   - CPM ממוצע: ₪${p.metrics.avgCpm}
   - קליקים: ${p.metrics.totalClicks.toLocaleString()}
   - חשיפות: ${p.metrics.totalImpressions.toLocaleString()}
   - קמפיינים: ${p.metrics.campaigns.join(', ') || 'לא צוין'}
`).join('\n')}

**משימות:**
1. השווה את הביצועים בין התקופות - מי הכי טוב ומי הכי גרוע ולמה
2. זהה מגמות ושינויים משמעותיים בין התקופות
3. תן ציון כולל (1-10) לביצועים עם הסבר קצר
4. הצע 3 המלצות קונקרטיות לשיפור לפני האירוע הבא

**פורמט התשובה:** עברית, עם כותרות ברורות (##), אימוג'ים, ונקודות. תשובה מקצועית אבל ברורה.`;
    } else if (analysisType === 'trends') {
      analysisPrompt = `אתה אנליסט שיווק דיגיטלי מומחה. נתח את המגמות בנתוני הקמפיינים הבאים:

${eventPeriods.map(p => `📅 ${p.eventDate}: ₪${p.metrics.totalSpend} הוצאה, ${p.metrics.totalLeads} לידים, ₪${p.metrics.avgCostPerLead} לליד`).join('\n')}

זהה:
1. מגמות עולות/יורדות
2. תקופות חריגות
3. דפוסים חוזרים
4. תחזית לאירוע הבא

פורמט: עברית, כותרות ##, אימוג'ים.`;
    } else {
      analysisPrompt = `אתה יועץ שיווק דיגיטלי. בהתבסס על הנתונים הבאים, תן המלצות לשיפור:

${eventPeriods.map(p => `📅 ${p.eventDate}: ₪${p.metrics.totalSpend} הוצאה, ${p.metrics.totalLeads} לידים, ₪${p.metrics.avgCostPerLead} לליד, CTR: ${p.metrics.avgCtr}%`).join('\n')}

תן 5 המלצות קונקרטיות ומעשיות לשיפור הביצועים.
פורמט: עברית, ממוספר, אימוג'ים.`;
    }

    // Add custom instructions if provided
    if (customInstructions) {
      analysisPrompt += `\n\n**הנחיות נוספות מהמשתמש:**\n${customInstructions}`;
    }

    // Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "אתה אנליסט שיווק דיגיטלי מומחה. תן תשובות מקצועיות, ברורות ומועילות בעברית." },
          { role: "user", content: analysisPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const analysisText = aiData.choices?.[0]?.message?.content || 'לא התקבל ניתוח';

    return new Response(
      JSON.stringify({
        success: true,
        periods: eventPeriods,
        analysis: analysisText,
        analysisType,
        daysBeforeEvent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-campaign-data:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
