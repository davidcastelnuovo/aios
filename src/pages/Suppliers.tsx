import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, Phone, Mail } from "lucide-react";

export default function Suppliers() {
  const { data: suppliers, isLoading } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const getTypeColor = (type: string) => {
    switch (type) {
      case "campaigner":
        return "bg-success/10 text-success border-success/20";
      case "media":
        return "bg-primary/10 text-primary border-primary/20";
      case "design":
        return "bg-accent/10 text-accent border-accent/20";
      case "creative":
        return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "dev":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getTypeText = (type: string) => {
    const types: Record<string, string> = {
      campaigner: "קמפיינר",
      media: "מדיה",
      design: "עיצוב",
      creative: "קריאייטיב",
      dev: "פיתוח",
      other: "אחר",
    };
    return types[type] || type;
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">טוען...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">ספקים</h2>
        <p className="text-muted-foreground mt-1">ניהול ספקים ונותני שירותים</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {suppliers?.map((supplier) => (
          <Card key={supplier.id} className="shadow-card hover:shadow-lg transition-all hover:scale-[1.02]">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Truck className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{supplier.name}</CardTitle>
                </div>
                <Badge variant="outline" className={getTypeColor(supplier.type)}>
                  {getTypeText(supplier.type)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {supplier.phone && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  <span dir="ltr">{supplier.phone}</span>
                </div>
              )}
              {supplier.email && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>{supplier.email}</span>
                </div>
              )}
              {supplier.notes && (
                <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">
                  {supplier.notes}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {suppliers?.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Truck className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">אין ספקים</h3>
            <p className="text-sm text-muted-foreground">התחל בהוספת ספק ראשון</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}