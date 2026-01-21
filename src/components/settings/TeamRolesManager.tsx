import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useTeamRoles, useUpdateTeamRoles, TeamRole } from "@/hooks/useTeamRoles";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * קומפוננטה לניהול תפקידי צוות מותאמים אישית
 * מאפשרת למנהל טנט להוסיף, לערוך, ולמחוק תפקידים
 */
export function TeamRolesManager() {
  const { teamRoles, isLoading, orgType, defaultRoles } = useTeamRoles();
  const { updateRoles } = useUpdateTeamRoles();
  const queryClient = useQueryClient();

  const [customRoles, setCustomRoles] = useState<TeamRole[]>(teamRoles);
  const [newRoleKey, setNewRoleKey] = useState("");
  const [newRoleLabel, setNewRoleLabel] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  // עדכון customRoles כאשר teamRoles משתנה
  useEffect(() => {
    setCustomRoles(teamRoles);
  }, [teamRoles]);

  const saveMutation = useMutation({
    mutationFn: async (roles: TeamRole[]) => {
      await updateRoles(roles);
    },
    onSuccess: () => {
      toast.success("תפקידי הצוות עודכנו בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["tenant-team-roles"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-org-type"] });
      setHasChanges(false);
    },
    onError: (error: Error) => {
      toast.error("שגיאה בעדכון תפקידי הצוות: " + error.message);
    },
  });

  const addRole = () => {
    if (!newRoleKey.trim() || !newRoleLabel.trim()) {
      toast.error("יש למלא מפתח ותיאור לתפקיד");
      return;
    }

    // בדיקה שהמפתח לא קיים כבר
    if (customRoles.some(r => r.key === newRoleKey)) {
      toast.error("מפתח זה כבר קיים");
      return;
    }

    const newRole: TeamRole = {
      key: newRoleKey.toLowerCase().replace(/\s+/g, '_'),
      label: newRoleLabel,
    };

    setCustomRoles([...customRoles, newRole]);
    setNewRoleKey("");
    setNewRoleLabel("");
    setHasChanges(true);
  };

  const removeRole = (key: string) => {
    setCustomRoles(customRoles.filter(r => r.key !== key));
    setHasChanges(true);
  };

  const resetToDefaults = () => {
    const defaults = defaultRoles[orgType] || defaultRoles.organization;
    setCustomRoles(defaults);
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(customRoles);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>תפקידי צוות</CardTitle>
          <CardDescription>טוען...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const orgTypeLabel = orgType === 'organization' || orgType === 'root' ? 'סוכנות' : 'עסק כללי';

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>תפקידי צוות</CardTitle>
            <CardDescription>
              הגדר את התפקידים הזמינים עבור אנשי הצוות ({orgTypeLabel})
            </CardDescription>
          </div>
          {hasChanges && (
            <Badge variant="outline" className="bg-amber-50">
              שינויים שלא נשמרו
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* רשימת תפקידים קיימים */}
        <div>
          <Label className="text-base font-semibold mb-3 block">תפקידים קיימים</Label>
          <div className="flex flex-wrap gap-2">
            {customRoles.map((role) => (
              <Badge
                key={role.key}
                variant="secondary"
                className="text-sm px-3 py-1.5 flex items-center gap-2"
              >
                <span>{role.label}</span>
                <button
                  type="button"
                  onClick={() => removeRole(role.key)}
                  className="hover:bg-destructive/20 rounded-full p-0.5"
                  aria-label={`מחק ${role.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          {customRoles.length === 0 && (
            <p className="text-sm text-muted-foreground">אין תפקידים מוגדרים</p>
          )}
        </div>

        {/* הוספת תפקיד חדש */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <Label className="text-base font-semibold">הוסף תפקיד חדש</Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="role-key">מפתח (באנגלית)</Label>
              <Input
                id="role-key"
                value={newRoleKey}
                onChange={(e) => setNewRoleKey(e.target.value)}
                placeholder="customer_service"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                ללא רווחים, אותיות קטנות בלבד
              </p>
            </div>
            <div>
              <Label htmlFor="role-label">שם התפקיד (בעברית)</Label>
              <Input
                id="role-label"
                value={newRoleLabel}
                onChange={(e) => setNewRoleLabel(e.target.value)}
                placeholder="שירות לקוחות"
                className="mt-1"
              />
            </div>
          </div>
          <Button
            type="button"
            onClick={addRole}
            size="sm"
            className="w-full md:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            הוסף תפקיד
          </Button>
        </div>

        {/* פעולות */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saveMutation.isPending}
            className="flex-1"
          >
            {saveMutation.isPending ? "שומר..." : "שמור שינויים"}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="flex-1">
                <RotateCcw className="h-4 w-4 mr-2" />
                איפוס לברירת מחדל
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>איפוס לברירת מחדל?</AlertDialogTitle>
                <AlertDialogDescription>
                  פעולה זו תחזיר את רשימת התפקידים לברירת המחדל של {orgTypeLabel}.
                  כל התפקידים המותאמים אישית יימחקו.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ביטול</AlertDialogCancel>
                <AlertDialogAction onClick={resetToDefaults}>
                  אפס לברירת מחדל
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* הסבר */}
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>טיפ:</strong> תפקידים אלה ישמשו בעת הוספת אנשי צוות חדשים.
            כל שינוי יחול מיידית על כל הטפסים במערכת.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
