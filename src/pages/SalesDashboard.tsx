import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAgency } from "@/contexts/AgencyContext";
import { Target, Users, TrendingUp, DollarSign, Clock, CheckCircle2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format, subDays, startOfDay } from "date-fns";

export default function SalesDashboard() {
  const { selectedAgency } = useAgency();

  const { data: leadsStats, isLoading: leadsLoading } = useQuery({
    queryKey: ["leads-stats", selectedAgency],
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select("status, estimated_deal_value");

      if (selectedAgency && selectedAgency !== "all") {
        query = query.eq("agency_id", selectedAgency);
      }

      const { data, error } = await query;
      if (error) throw error;

      const stats = {
        total: data.length,
        new: data.filter(l => l.status === "new").length,
        contacted: data.filter(l => l.status === "contacted").length,
        followUp: data.filter(l => l.status === "follow_up").length,
        proposal: data.filter(l => l.status === "proposal_sent").length,
        closed: data.filter(l => l.status === "closed").length,
        totalValue: data.reduce((sum, l) => sum + (l.estimated_deal_value || 0), 0),
        closedValue: data
          .filter(l => l.status === "closed")
          .reduce((sum, l) => sum + (l.estimated_deal_value || 0), 0),
        newValue: data
          .filter(l => l.status === "new")
          .reduce((sum, l) => sum + (l.estimated_deal_value || 0), 0),
        contactedValue: data
          .filter(l => l.status === "contacted")
          .reduce((sum, l) => sum + (l.estimated_deal_value || 0), 0),
        followUpValue: data
          .filter(l => l.status === "follow_up")
          .reduce((sum, l) => sum + (l.estimated_deal_value || 0), 0),
        proposalValue: data
          .filter(l => l.status === "proposal_sent")
          .reduce((sum, l) => sum + (l.estimated_deal_value || 0), 0),
      };

      return stats;
    },
  });

  const { data: salesPeopleStats } = useQuery({
    queryKey: ["sales-people-stats", selectedAgency],
    queryFn: async () => {
      let query = supabase
        .from("sales_people")
        .select("id, full_name, active");

      if (selectedAgency && selectedAgency !== "all") {
        query = query.eq("agency_id", selectedAgency);
      }

      const { data, error } = await query;
      if (error) throw error;

      return {
        total: data.length,
        active: data.filter(sp => sp.active).length,
      };
    },
  });

  const { data: timelineData } = useQuery({
    queryKey: ["leads-timeline", selectedAgency],
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select("created_at, status, updated_at, won_date");

      if (selectedAgency && selectedAgency !== "all") {
        query = query.eq("agency_id", selectedAgency);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by date for the last 30 days
      const last30Days = Array.from({ length: 30 }, (_, i) => {
        const date = startOfDay(subDays(new Date(), 29 - i));
        return {
          date: format(date, "dd/MM"),
          fullDate: date,
          newLeads: 0,
          proposals: 0,
          closed: 0,
        };
      });

      data.forEach((lead) => {
        const createdDate = startOfDay(new Date(lead.created_at));
        const dayIndex = last30Days.findIndex(
          (d) => d.fullDate.getTime() === createdDate.getTime()
        );

        if (dayIndex !== -1) {
          last30Days[dayIndex].newLeads++;
        }

        // Count proposals by updated_at
        if (lead.status === "proposal_sent") {
          const updatedDate = startOfDay(new Date(lead.updated_at));
          const updateIndex = last30Days.findIndex(
            (d) => d.fullDate.getTime() === updatedDate.getTime()
          );
          
          if (updateIndex !== -1) {
            last30Days[updateIndex].proposals++;
          }
        }
        
        // Count closed by won_date
        if (lead.status === "closed" && lead.won_date) {
          const wonDate = startOfDay(new Date(lead.won_date));
          const wonIndex = last30Days.findIndex(
            (d) => d.fullDate.getTime() === wonDate.getTime()
          );
          
          if (wonIndex !== -1) {
            last30Days[wonIndex].closed++;
          }
        }
      });

      return last30Days;
    },
  });

  if (leadsLoading) {
    return (
      <AppLayout>
        <div className="p-8">טוען...</div>
      </AppLayout>
    );
  }

  const conversionRate = leadsStats?.total 
    ? ((leadsStats.closed / leadsStats.total) * 100).toFixed(1)
    : "0";

  return (
    <AppLayout>
      <div className="p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">דשבורד מכירות</h1>
          <p className="text-muted-foreground mt-2">
            סקירה כללית של פעילות המכירות והלידים
          </p>
        </div>

        {/* סטטיסטיקות כלליות */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">סה"כ לידים</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{leadsStats?.total || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                לידים פעילים במערכת
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">אנשי מכירות</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{salesPeopleStats?.active || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">
                מתוך {salesPeopleStats?.total || 0} סה"כ
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">שיעור המרה</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{conversionRate}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                לידים שנסגרו בהצלחה
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">שווי עסקאות</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₪{leadsStats?.closedValue?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                עסקאות שנסגרו
              </p>
            </CardContent>
          </Card>
        </div>

        {/* גרף ציר זמן */}
        <Card>
          <CardHeader>
            <CardTitle>מעקב זמן - 30 ימים אחרונים</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  style={{ fontSize: '12px' }}
                />
                <YAxis style={{ fontSize: '12px' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))' 
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="newLeads" 
                  name="לידים חדשים"
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="proposals" 
                  name="הצעות מחיר"
                  stroke="#f97316" 
                  strokeWidth={2}
                  dot={{ fill: '#f97316' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="closed" 
                  name="עסקאות שנסגרו"
                  stroke="#22c55e" 
                  strokeWidth={2}
                  dot={{ fill: '#22c55e' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* שלבי משפך המכירה */}
        <Card>
          <CardHeader>
            <CardTitle>משפך מכירות</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 overflow-x-auto pb-4">
              {/* ליד חדש */}
              <div className="relative flex-1 min-w-[200px]">
                <div 
                  className="relative bg-blue-50 dark:bg-blue-950/20 p-4 rounded-t-lg shadow-md"
                  style={{
                    clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 20px), 50% 100%, 0 calc(100% - 20px))"
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Target className="h-5 w-5 text-blue-500" />
                    <span className="text-sm font-medium">ליד חדש</span>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">{leadsStats?.new || 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">לידים</div>
                    <div className="text-sm font-medium mt-2">
                      ₪{leadsStats?.newValue?.toLocaleString() || 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* נוצר קשר */}
              <div className="relative flex-1 min-w-[200px]">
                <div 
                  className="relative bg-purple-50 dark:bg-purple-950/20 p-4 rounded-t-lg shadow-md"
                  style={{
                    clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 20px), 50% 100%, 0 calc(100% - 20px))"
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-5 w-5 text-purple-500" />
                    <span className="text-sm font-medium">נוצר קשר</span>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600">{leadsStats?.contacted || 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">לידים</div>
                    <div className="text-sm font-medium mt-2">
                      ₪{leadsStats?.contactedValue?.toLocaleString() || 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* תהליך פולואפ */}
              <div className="relative flex-1 min-w-[200px]">
                <div 
                  className="relative bg-yellow-50 dark:bg-yellow-950/20 p-4 rounded-t-lg shadow-md"
                  style={{
                    clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 20px), 50% 100%, 0 calc(100% - 20px))"
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-5 w-5 text-yellow-500" />
                    <span className="text-sm font-medium">תהליך פולואפ</span>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-600">{leadsStats?.followUp || 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">לידים</div>
                    <div className="text-sm font-medium mt-2">
                      ₪{leadsStats?.followUpValue?.toLocaleString() || 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* נשלחה הצעה */}
              <div className="relative flex-1 min-w-[200px]">
                <div 
                  className="relative bg-orange-50 dark:bg-orange-950/20 p-4 rounded-t-lg shadow-md"
                  style={{
                    clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 20px), 50% 100%, 0 calc(100% - 20px))"
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-5 w-5 text-orange-500" />
                    <span className="text-sm font-medium">נשלחה הצעה</span>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-600">{leadsStats?.proposal || 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">לידים</div>
                    <div className="text-sm font-medium mt-2">
                      ₪{leadsStats?.proposalValue?.toLocaleString() || 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* נסגר */}
              <div className="relative flex-1 min-w-[200px]">
                <div 
                  className="relative bg-green-50 dark:bg-green-950/20 p-4 rounded-t-lg shadow-md"
                  style={{
                    clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 20px), 50% 100%, 0 calc(100% - 20px))"
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium">נסגר</span>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">{leadsStats?.closed || 0}</div>
                    <div className="text-xs text-muted-foreground mt-1">לידים</div>
                    <div className="text-sm font-medium text-green-600 mt-2">
                      ₪{leadsStats?.closedValue?.toLocaleString() || 0}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* שווי פוטנציאלי */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>שווי כולל משוער</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                ₪{leadsStats?.totalValue?.toLocaleString() || 0}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                סכום כל הלידים במשפך
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>שווי הצעות מחיר</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-orange-600">
                ₪{leadsStats?.proposalValue?.toLocaleString() || 0}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                הצעות מחיר לפני סגירה
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>עסקאות שנסגרו</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                ₪{leadsStats?.closedValue?.toLocaleString() || 0}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                סכום עסקאות שנסגרו
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
