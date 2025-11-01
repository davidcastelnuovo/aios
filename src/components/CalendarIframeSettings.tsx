import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Calendar, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export function CalendarIframeSettings() {
  const { userId } = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [iframeCode, setIframeCode] = useState("");

  const { data: profile } = useQuery({
    queryKey: ["calendar-iframe", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("calendar_iframe_code")
        .eq("id", userId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const updateMutation = useMutation({
    mutationFn: async (newCode: string) => {
      if (!userId) throw new Error("No user ID");
      
      const { error } = await supabase
        .from("profiles")
        .update({ calendar_iframe_code: newCode })
        .eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-iframe", userId] });
      setIsEditing(false);
      toast({
        title: "יומן עודכן בהצלחה",
        description: "קוד ה-iframe נשמר במערכת",
      });
    },
    onError: (error) => {
      toast({
        title: "שגיאה בשמירה",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = () => {
    setIframeCode(profile?.calendar_iframe_code || "");
    setIsEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate(iframeCode);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setIframeCode("");
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="border-b bg-muted/30">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          יומן Google שלי
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {isEditing ? (
          <>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm space-y-2">
                <p className="font-semibold">איך להשיג את קוד ה-iframe מ-Google Calendar:</p>
                <ol className="list-decimal mr-4 space-y-1">
                  <li>היכנס ליומן Google שלך: <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">calendar.google.com</a></li>
                  <li>בצד ימין, לחץ על הגדרות (סמל גלגל שיניים) ← הגדרות</li>
                  <li>בתפריט השמאלי, בחר את היומן שברצונך להטמיע</li>
                  <li>גלול למטה עד "שילוב היומן"</li>
                  <li>העתק את קוד ה-HTML שמתחיל ב- <code dir="ltr" className="bg-muted px-1 py-0.5 rounded text-xs">&lt;iframe src="...</code></li>
                  <li>הדבק את הקוד כאן למטה</li>
                </ol>
                <p className="text-muted-foreground text-xs mt-2">
                  * שים לב: היומן חייב להיות ציבורי או משותף כדי שה-iframe יעבוד
                </p>
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <label className="text-sm font-medium">קוד Iframe</label>
              <Textarea
                value={iframeCode}
                onChange={(e) => setIframeCode(e.target.value)}
                placeholder='<iframe src="https://calendar.google.com/calendar/embed?src=..." style="border: 0" width="800" height="600" frameborder="0" scrolling="no"></iframe>'
                rows={6}
                className="font-mono text-xs"
                dir="ltr"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "שומר..." : "שמור"}
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                ביטול
              </Button>
            </div>
          </>
        ) : (
          <>
            {profile?.calendar_iframe_code ? (
              <div className="space-y-4">
                <div className="w-full overflow-hidden rounded-lg border">
                  <div 
                    dangerouslySetInnerHTML={{ __html: profile.calendar_iframe_code }}
                    className="w-full"
                  />
                </div>
                <Button onClick={handleEdit} variant="outline" size="sm">
                  ערוך יומן
                </Button>
              </div>
            ) : (
              <div className="text-center py-8 space-y-4">
                <p className="text-muted-foreground">לא הוגדר עדיין יומן Google</p>
                <Button onClick={handleEdit}>
                  הוסף יומן
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}