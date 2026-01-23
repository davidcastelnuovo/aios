import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { 
  Globe, 
  Clock, 
  MousePointer, 
  Eye, 
  ArrowRight, 
  Smartphone,
  Monitor,
  Tablet,
  MapPin,
  ExternalLink
} from "lucide-react";

interface VisitorJourneyProps {
  leadId: string;
}

interface JourneySession {
  session_id: string;
  started_at: string;
  duration_seconds: number;
  page_count: number;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  landing_page: string | null;
  device_type: string | null;
  pages: Array<{
    url: string;
    title: string | null;
    time_on_page: number;
    scroll_depth: number;
    viewed_at: string;
  }>;
  events: Array<{
    name: string;
    category: string | null;
    label: string | null;
    data: Record<string, unknown> | null;
    occurred_at: string;
  }>;
}

export function VisitorJourney({ leadId }: VisitorJourneyProps) {
  const { data: journey, isLoading } = useQuery({
    queryKey: ["visitor_journey", leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_lead_visitor_journey", { p_lead_id: leadId });
      
      if (error) throw error;
      return (data as JourneySession[]) || [];
    },
    enabled: !!leadId,
  });

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getDeviceIcon = (device: string | null) => {
    switch (device) {
      case "mobile": return <Smartphone className="h-4 w-4" />;
      case "tablet": return <Tablet className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  const getSourceLabel = (session: JourneySession) => {
    if (session.utm_source) {
      return session.utm_source;
    }
    if (session.referrer) {
      try {
        return new URL(session.referrer).hostname;
      } catch {
        return session.referrer;
      }
    }
    return "ישיר";
  };

  if (isLoading) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        טוען מסע לקוח...
      </div>
    );
  }

  if (!journey || journey.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Globe className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">
            אין נתוני מעקב עבור ליד זה
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            נתונים יופיעו כאן כאשר המבקר יזוהה דרך טופס באתר
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Globe className="h-4 w-4" />
        <span>{journey.length} ביקורים באתר</span>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-4 pr-4">
          {journey.map((session, sessionIndex) => (
            <Card key={session.session_id} className="relative">
              {/* Timeline connector */}
              {sessionIndex < journey.length - 1 && (
                <div className="absolute -bottom-4 right-6 w-0.5 h-4 bg-border" />
              )}

              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getDeviceIcon(session.device_type)}
                    <CardTitle className="text-sm">
                      {format(new Date(session.started_at), "dd/MM/yyyy HH:mm", { locale: he })}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {getSourceLabel(session)}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      <Clock className="h-3 w-3 ml-1" />
                      {formatDuration(session.duration_seconds)}
                    </Badge>
                  </div>
                </div>
                
                {session.utm_campaign && (
                  <p className="text-xs text-muted-foreground">
                    קמפיין: {session.utm_campaign}
                  </p>
                )}
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Pages visited */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Eye className="h-3 w-3" />
                    דפים ({session.page_count})
                  </div>
                  <div className="space-y-1">
                    {(session.pages || []).slice(0, 5).map((page, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1">
                        <Badge variant="outline" className="text-[10px] h-4 px-1">
                          {idx + 1}
                        </Badge>
                        <span className="truncate flex-1" title={page.url}>
                          {page.title || page.url}
                        </span>
                        <span className="text-muted-foreground shrink-0">
                          {formatDuration(page.time_on_page)}
                        </span>
                        {page.scroll_depth > 0 && (
                          <span className="text-muted-foreground shrink-0">
                            {page.scroll_depth}%↓
                          </span>
                        )}
                      </div>
                    ))}
                    {(session.pages || []).length > 5 && (
                      <p className="text-xs text-muted-foreground pr-2">
                        +{session.pages.length - 5} דפים נוספים
                      </p>
                    )}
                  </div>
                </div>

                {/* Events */}
                {session.events && session.events.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                      <MousePointer className="h-3 w-3" />
                      אירועים ({session.events.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {session.events.slice(0, 8).map((event, idx) => (
                        <Badge key={idx} variant="secondary" className="text-[10px]">
                          {event.name}
                          {event.label && `: ${event.label.substring(0, 20)}`}
                        </Badge>
                      ))}
                      {session.events.length > 8 && (
                        <Badge variant="outline" className="text-[10px]">
                          +{session.events.length - 8}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Landing page */}
                {session.landing_page && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />
                    <span>דף נחיתה:</span>
                    <span className="truncate" title={session.landing_page}>
                      {new URL(session.landing_page).pathname}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
