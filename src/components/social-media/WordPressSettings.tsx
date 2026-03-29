import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useWordPressSites, useCreateWordPressSite, useDeleteWordPressSite } from "@/hooks/useSocialMedia";
import { Globe, Plus, Trash2, Loader2, ExternalLink } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export function WordPressSettings() {
  const { data: sites = [], isLoading } = useWordPressSites();
  const createSite = useCreateWordPressSite();
  const deleteSite = useDeleteWordPressSite();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    site_url: "",
    username: "",
    app_password: "",
    site_name: "",
  });

  const handleCreate = async () => {
    if (!form.site_url || !form.username || !form.app_password) return;
    await createSite.mutateAsync({
      site_url: form.site_url.replace(/\/$/, ""),
      username: form.username,
      app_password: form.app_password,
      site_name: form.site_name || undefined,
    });
    setForm({ site_url: "", username: "", app_password: "", site_name: "" });
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>אתרי וורדפרס</CardTitle>
          <CardDescription>
            חבר אתרי וורדפרס לפרסום פוסטים ישירות מהמערכת.
            נדרש Application Password בוורדפרס.
          </CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 ml-2" />
              הוסף אתר
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>הוסף אתר וורדפרס</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>שם האתר (אופציונלי)</Label>
                <Input
                  value={form.site_name}
                  onChange={(e) => setForm({ ...form, site_name: e.target.value })}
                  placeholder="האתר שלי"
                />
              </div>
              <div>
                <Label>כתובת האתר</Label>
                <Input
                  value={form.site_url}
                  onChange={(e) => setForm({ ...form, site_url: e.target.value })}
                  placeholder="https://example.com"
                  dir="ltr"
                />
              </div>
              <div>
                <Label>שם משתמש</Label>
                <Input
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="admin"
                  dir="ltr"
                />
              </div>
              <div>
                <Label>Application Password</Label>
                <Input
                  type="password"
                  value={form.app_password}
                  onChange={(e) => setForm({ ...form, app_password: e.target.value })}
                  placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  ניתן ליצור Application Password בוורדפרס תחת Users → Profile → Application Passwords
                </p>
              </div>
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={!form.site_url || !form.username || !form.app_password || createSite.isPending}
              >
                {createSite.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                הוסף אתר
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : sites.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            אין אתרי וורדפרס מוגדרים
          </p>
        ) : (
          <div className="space-y-3">
            {sites.map((site) => (
              <div
                key={site.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                    <Globe className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">{site.site_name || site.site_url}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1" dir="ltr">
                      {site.site_url}
                      <ExternalLink className="h-3 w-3" />
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={site.is_active ? "default" : "secondary"}>
                    {site.is_active ? "פעיל" : "לא פעיל"}
                  </Badge>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>מחק אתר</AlertDialogTitle>
                        <AlertDialogDescription>
                          האם אתה בטוח שברצונך למחוק את האתר "{site.site_name || site.site_url}"?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>ביטול</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteSite.mutate(site.id)}>
                          מחק
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
