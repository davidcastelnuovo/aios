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
        .select("created_at, status, updated_at");

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

        // Count proposals and closed by status
        if (lead.status === "proposal_sent" || lead.status === "closed") {
          const updatedDate = startOfDay(new Date(lead.updated_at));
          const updateIndex = last30Days.findIndex(
            (d) => d.fullDate.getTime() === updatedDate.getTime()
          );
          
          if (updateIndex !== -1) {
            if (lead.status === "proposal_sent") {
              last30Days[updateIndex].proposals++;
            } else if (lead.status === "closed") {
              last30Days[updateIndex].closed++;
            }
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-500" />
                  <span className="text-sm font-medium">ליד חדש</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{leadsStats?.new || 0}</span>
                  <span className="text-sm text-muted-foreground">לידים</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium">נוצר קשר</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{leadsStats?.contacted || 0}</span>
                  <span className="text-sm text-muted-foreground">לידים</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium">תהליך פולואפ</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{leadsStats?.followUp || 0}</span>
                  <span className="text-sm text-muted-foreground">לידים</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">נשלחה הצעה</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{leadsStats?.proposal || 0}</span>
                  <span className="text-sm text-muted-foreground">לידים</span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">נסגר</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-green-600">{leadsStats?.closed || 0}</span>
                  <span className="text-sm text-muted-foreground">לידים</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* שווי פוטנציאלי */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
