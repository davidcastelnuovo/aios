import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAgency } from "@/contexts/AgencyContext";
import { Target, Users, TrendingUp, DollarSign, Clock, CheckCircle2 } from "lucide-react";

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
        meeting: data.filter(l => l.status === "meeting_scheduled").length,
        proposal: data.filter(l => l.status === "proposal_sent").length,
        negotiation: data.filter(l => l.status === "negotiation").length,
        won: data.filter(l => l.status === "won").length,
        lost: data.filter(l => l.status === "lost").length,
        totalValue: data.reduce((sum, l) => sum + (l.estimated_deal_value || 0), 0),
        wonValue: data
          .filter(l => l.status === "won")
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

  if (leadsLoading) {
    return (
      <AppLayout>
        <div className="p-8">טוען...</div>
      </AppLayout>
    );
  }

  const conversionRate = leadsStats?.total 
    ? ((leadsStats.won / leadsStats.total) * 100).toFixed(1)
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
                ₪{leadsStats?.wonValue?.toLocaleString() || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                עסקאות שנסגרו
              </p>
            </CardContent>
          </Card>
        </div>

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
                  <span className="text-sm font-medium">חדש</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{leadsStats?.new || 0}</span>
                  <span className="text-sm text-muted-foreground">לידים</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium">יצירת קשר</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{leadsStats?.contacted || 0}</span>
                  <span className="text-sm text-muted-foreground">לידים</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-500" />
                  <span className="text-sm font-medium">פגישה מתוכננת</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{leadsStats?.meeting || 0}</span>
                  <span className="text-sm text-muted-foreground">לידים</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">הצעה נשלחה</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{leadsStats?.proposal || 0}</span>
                  <span className="text-sm text-muted-foreground">לידים</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium">משא ומתן</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold">{leadsStats?.negotiation || 0}</span>
                  <span className="text-sm text-muted-foreground">לידים</span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">נסגר</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-green-600">{leadsStats?.won || 0}</span>
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
                ₪{leadsStats?.wonValue?.toLocaleString() || 0}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                סכום עסקאות שנסגרו בהצלחה
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
