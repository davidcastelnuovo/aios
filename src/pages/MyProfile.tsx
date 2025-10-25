import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, Folder, Briefcase, Calendar, ChevronDown, ChevronUp } from "lucide-react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { useState, useEffect } from "react";

export default function MyProfile() {
  const { userId } = useCurrentUser();
  const [showAssignments, setShowAssignments] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["my-profile", userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select(`
          *,
          campaigners (*),
          sales_people (*)
        `)
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: assignments } = useQuery({
    queryKey: ["my-assignments", profile?.campaigner_id],
    queryFn: async () => {
      if (!profile?.campaigner_id) return [];

      const { data, error } = await supabase
        .from("client_team")
        .select(`
          *,
          clients (
            id,
            name,
            status,
            agencies (name)
          )
        `)
        .eq("campaigner_id", profile.campaigner_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.campaigner_id,
  });

  // Fetch leads for sales people
  const { data: salesLeads } = useQuery({
    queryKey: ["my-sales-leads", profile?.sales_person_id],
    queryFn: async () => {
      if (!profile?.sales_person_id) return [];

      const { data, error } = await supabase
        .from("leads")
        .select(`
          *,
          agencies (name)
        `)
        .eq("sales_person_id", profile.sales_person_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!profile?.sales_person_id,
  });

  // Fetch sales person details explicitly (avoid relying on FK-based embedding)
  const { data: salesPerson } = useQuery({
    queryKey: ["my-sales-person", profile?.sales_person_id],
    queryFn: async () => {
      if (!profile?.sales_person_id) return null;
      const { data, error } = await supabase
        .from("sales_people")
        .select("id, full_name, email, phone, folder_link, active, notes")
        .eq("id", profile.sales_person_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.sales_person_id,
  });

  // Fetch agencies linked to the sales person (supports multiple)
  const { data: salesPersonAgencies } = useQuery({
    queryKey: ["my-sales-person-agencies", profile?.sales_person_id],
    queryFn: async () => {
      if (!profile?.sales_person_id) return [];
      const { data, error } = await supabase
        .from("sales_person_agencies")
        .select(`
          agencies (
            id,
            name
          )
        `)
        .eq("sales_person_id", profile.sales_person_id);
      if (error) throw error;
      return (data || []).map((row: any) => row.agencies).filter(Boolean);
    },
    enabled: !!profile?.sales_person_id,
  });

  const { data: agencies } = useQuery({
    queryKey: ["my-agencies", profile?.campaigner_id],
    queryFn: async () => {
      if (!profile?.campaigner_id) return [];

      const { data, error } = await supabase
        .from("campaigner_agencies")
        .select(`
          agencies (
            id,
            name
          )
        `)
        .eq("campaigner_id", profile.campaigner_id);

      if (error) throw error;
      return data?.map(item => item.agencies).filter(Boolean) || [];
    },
    enabled: !!profile?.campaigner_id,
  });

  // Also fetch agencies managed by the user (team managers)
  const { data: managedAgencies } = useQuery({
    queryKey: ["my-managed-agencies", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("user_managed_agencies")
        .select(`
          agencies (
            id,
            name
          )
        `)
        .eq("user_id", userId);
      if (error) throw error;
      return data?.map((item: any) => item.agencies).filter(Boolean) || [];
    },
    enabled: !!userId,
  });

  // Merge agencies from campaigner links and managed agencies
  const mergedAgencies = (() => {
    const map = new Map<string, any>();
    (agencies || []).forEach((a: any) => a && map.set(a.id, a));
    (managedAgencies || []).forEach((a: any) => a && map.set(a.id, a));
    return Array.from(map.values());
  })();

  // Realtime updates: refresh profile and assignments/agencies when data changes
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('my-profile-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['my-profile', userId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, queryClient]);

  useEffect(() => {
    if (!profile?.campaigner_id) return;
    const channel = supabase
      .channel('my-campaigner-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'client_team', filter: `campaigner_id=eq.${profile.campaigner_id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['my-assignments', profile.campaigner_id] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'campaigner_agencies', filter: `campaigner_id=eq.${profile.campaigner_id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['my-agencies', profile.campaigner_id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.campaigner_id, queryClient]);

  const calculateTotal = () => {
    if (!assignments) return 0;
    return assignments
      .filter(assignment => 
        assignment.clients?.status === "active" || 
        assignment.clients?.status === "onboarding"
      )
      .reduce((sum, assignment) => {
        return sum + Number(assignment.campaigner_payment || 0);
      }, 0);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-success/10 text-success border-success/20";
      case "onboarding":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "paused":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "ended":
        return "bg-muted text-muted-foreground border-border";
      default:
        return "";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "active":
        return "פעיל";
      case "onboarding":
        return "בקליטה";
      case "paused":
        return "מושהה";
      case "ended":
        return "הסתיים";
      default:
        return status;
    }
  };

  if (profileLoading) {
    return <div className="flex justify-center p-8">טוען...</div>;
  }

  // Check if user is a sales person or campaigner
  const isSalesPerson = !!profile?.sales_person_id;
  const isCampaigner = !!profile?.campaigner_id;

  if (!isSalesPerson && !isCampaigner) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h2 className="text-3xl font-bold">אזור אישי</h2>
        </div>
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">לא נמצא פרופיל עבור המשתמש שלך.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const person = isSalesPerson ? salesPerson : profile.campaigners;
  const totalPayment = isCampaigner ? calculateTotal() : 0;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h2 className="text-3xl font-bold">אזור אישי</h2>
      </div>

      <Card className="shadow-card">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">{person?.full_name || profile?.full_name || ""}</CardTitle>
            <Badge variant={person?.active ? "default" : "secondary"}>
              {person?.active ? "פעיל" : "לא פעיל"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Contact Information */}
          <div className="space-y-3">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              פרטי קשר
            </h3>
            <div className="grid gap-3">
              {person.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span dir="ltr">{person.phone}</span>
                </div>
              )}
              {person.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{person.email}</span>
                </div>
              )}
              {person.folder_link && (
                <div className="flex items-center gap-3 text-sm">
                  <Folder className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={person.folder_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    קישור לתיקיה
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Agencies - only for campaigners */}
          {isCampaigner && mergedAgencies && mergedAgencies.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">סוכנויות</h3>
              <div className="flex flex-wrap gap-2">
                {mergedAgencies.map((agency: any) => (
                  <Badge key={agency.id} variant="outline">
                    {agency.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Agencies - for sales people */}
          {isSalesPerson && salesPersonAgencies && salesPersonAgencies.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">סוכנויות</h3>
              <div className="flex flex-wrap gap-2">
                {salesPersonAgencies.map((agency: any) => (
                  <Badge key={agency.id} variant="outline">
                    {agency.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {person?.notes && (
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">הערות</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {person?.notes}
              </p>
            </div>
          )}

          {/* Client Assignments - for campaigners */}
          {isCampaigner && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <button
                  className="w-full flex items-center justify-between p-2 hover:bg-muted/50 rounded text-foreground"
                  onClick={() => setShowAssignments(!showAssignments)}
                >
                  <h3 className="font-semibold text-lg">
                    לקוחות משויכים ({assignments?.filter(a => a.clients?.status === "active" || a.clients?.status === "onboarding").length || 0})
                  </h3>
                  {showAssignments ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </button>
              </div>
              {totalPayment > 0 && (
                <div className="flex items-center gap-2 text-primary font-semibold">
                  <span>סה"כ תשלום: ₪{totalPayment.toLocaleString()}</span>
                </div>
              )}
              
              {showAssignments && assignments && assignments.length > 0 && (
                <div className="space-y-3">
                  {assignments
                    .filter(assignment => 
                      assignment.clients?.status === "active" || 
                      assignment.clients?.status === "onboarding"
                    )
                    .map((assignment) => (
                    <Card key={assignment.id} className="bg-muted/30">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{assignment.clients?.name}</h4>
                              <Badge className={getStatusColor(assignment.clients?.status || "")}>
                                {getStatusText(assignment.clients?.status || "")}
                              </Badge>
                            </div>
                            
                            {assignment.clients?.agencies && (
                              <p className="text-sm text-muted-foreground">
                                {assignment.clients.agencies.name}
                              </p>
                            )}

                            {assignment.role_on_account && (
                              <p className="text-sm">
                                <span className="text-muted-foreground">תפקיד: </span>
                                {assignment.role_on_account}
                              </p>
                            )}

                            {assignment.allocation_percent && (
                              <p className="text-sm">
                                <span className="text-muted-foreground">אחוז הקצאה: </span>
                                {assignment.allocation_percent}%
                              </p>
                            )}

                            {(assignment.start_date || assignment.end_date) && (
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                {assignment.start_date && (
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>התחלה: {format(new Date(assignment.start_date), "dd/MM/yyyy", { locale: he })}</span>
                                  </div>
                                )}
                                {assignment.end_date && (
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    <span>סיום: {format(new Date(assignment.end_date), "dd/MM/yyyy", { locale: he })}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {assignment.notes && (
                              <p className="text-sm text-muted-foreground italic">
                                {assignment.notes}
                              </p>
                            )}
                          </div>

                          {assignment.campaigner_payment && Number(assignment.campaigner_payment) > 0 && (
                            <div className="text-left">
                              <Badge variant="outline" className="text-base font-semibold">
                                ₪{Number(assignment.campaigner_payment).toLocaleString()}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {showAssignments && (!assignments || assignments.length === 0) && (
                <p className="text-sm text-muted-foreground">אין לקוחות משויכים</p>
              )}
            </div>
          )}

          {/* Leads - for sales people */}
          {isSalesPerson && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <button
                  className="w-full flex items-center justify-between p-2 hover:bg-muted/50 rounded text-foreground"
                  onClick={() => setShowAssignments(!showAssignments)}
                >
                  <h3 className="font-semibold text-lg">
                    לידים שלי ({salesLeads?.length || 0})
                  </h3>
                  {showAssignments ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </button>
              </div>
              
              {showAssignments && salesLeads && salesLeads.length > 0 && (
                <div className="space-y-3">
                  {salesLeads.map((lead) => (
                    <Card key={lead.id} className="bg-muted/30">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{lead.company_name}</h4>
                              <Badge>{lead.status}</Badge>
                            </div>
                            
                            {lead.agencies && (
                              <p className="text-sm text-muted-foreground">
                                {lead.agencies.name}
                              </p>
                            )}

                            {lead.contact_name && (
                              <p className="text-sm">
                                <span className="text-muted-foreground">איש קשר: </span>
                                {lead.contact_name}
                              </p>
                            )}

                            {lead.email && (
                              <p className="text-sm">
                                <Mail className="h-3 w-3 inline ml-1" />
                                {lead.email}
                              </p>
                            )}

                            {lead.phone && (
                              <p className="text-sm" dir="ltr">
                                <Phone className="h-3 w-3 inline ml-1" />
                                {lead.phone}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {showAssignments && (!salesLeads || salesLeads.length === 0) && (
                <p className="text-sm text-muted-foreground">אין לידים משויכים</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
