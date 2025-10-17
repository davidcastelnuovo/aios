import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

const formSchema = z.object({
  name: z.string().min(1, "שם הלקוח נדרש"),
  agency_id: z.string().min(1, "סוכנות נדרשת"),
  phone: z.string().optional(),
  email: z.string().email("כתובת אימייל לא תקינה").optional().or(z.literal("")),
  folder_link: z.string().url("קישור לא תקין").optional().or(z.literal("")),
  industry: z.string().optional(),
  retainer: z.string().optional(),
  monthly_budget: z.string().optional(),
  website: z.string().url("כתובת אתר לא תקינה").optional().or(z.literal("")),
  notes: z.string().optional(),
  status: z.enum(["active", "paused", "ended"]),
  campaigner1_id: z.string().optional(),
  campaigner1_payment: z.string().optional(),
  campaigner2_id: z.string().optional(),
  campaigner2_payment: z.string().optional(),
  campaigner3_id: z.string().optional(),
  campaigner3_payment: z.string().optional(),
  campaigner4_id: z.string().optional(),
  campaigner4_payment: z.string().optional(),
});

interface EditClientDialogProps {
  client: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditClientDialog({ client, open, onOpenChange }: EditClientDialogProps) {
  const queryClient = useQueryClient();
  const { isOwner } = useUserRole();

  const { data: agencies } = useQuery({
    queryKey: ["agencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agencies")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: campaigners } = useQuery({
    queryKey: ["campaigners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigners")
        .select("id, full_name")
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: clientTeam } = useQuery({
    queryKey: ["client-team", client.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_team")
        .select("*")
        .eq("client_id", client.id);
      if (error) throw error;
      return data;
    },
    enabled: !!client.id,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: client.name || "",
      agency_id: client.agency_id || "",
      phone: client.phone || "",
      email: client.email || "",
      folder_link: client.folder_link || "",
      industry: client.industry || "",
      retainer: client.retainer?.toString() || "",
      monthly_budget: client.monthly_budget?.toString() || "",
      website: client.website || "",
      notes: client.notes || "",
      status: client.status || "active",
      campaigner1_id: "",
      campaigner1_payment: "",
      campaigner2_id: "",
      campaigner2_payment: "",
      campaigner3_id: "",
      campaigner3_payment: "",
      campaigner4_id: "",
      campaigner4_payment: "",
    },
  });

  // עדכון הערכים כשה-clientTeam מתקבל
  useEffect(() => {
    if (clientTeam && clientTeam.length > 0) {
      form.reset({
        name: client.name || "",
        agency_id: client.agency_id || "",
        phone: client.phone || "",
        email: client.email || "",
        folder_link: client.folder_link || "",
        industry: client.industry || "",
        retainer: client.retainer?.toString() || "",
        monthly_budget: client.monthly_budget?.toString() || "",
        website: client.website || "",
        notes: client.notes || "",
        status: client.status || "active",
        campaigner1_id: clientTeam[0]?.campaigner_id || "",
        campaigner1_payment: clientTeam[0]?.campaigner_payment?.toString() || "",
        campaigner2_id: clientTeam[1]?.campaigner_id || "",
        campaigner2_payment: clientTeam[1]?.campaigner_payment?.toString() || "",
        campaigner3_id: clientTeam[2]?.campaigner_id || "",
        campaigner3_payment: clientTeam[2]?.campaigner_payment?.toString() || "",
        campaigner4_id: clientTeam[3]?.campaigner_id || "",
        campaigner4_payment: clientTeam[3]?.campaigner_payment?.toString() || "",
      });
    }
  }, [clientTeam, client, form]);

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      // Update client data
      const { error: clientError } = await supabase
        .from("clients")
        .update({
          name: values.name,
          agency_id: values.agency_id,
          phone: values.phone || null,
          email: values.email || null,
          folder_link: values.folder_link || null,
          industry: values.industry || null,
          retainer: values.retainer ? parseFloat(values.retainer) : null,
          monthly_budget: values.monthly_budget ? parseFloat(values.monthly_budget) : null,
          website: values.website || null,
          notes: values.notes || null,
          status: values.status,
        })
        .eq("id", client.id);

      if (clientError) throw clientError;

      // Update client_team data
      const teamUpdates = [];
      
      if (values.campaigner1_id) {
        teamUpdates.push({
          client_id: client.id,
          campaigner_id: values.campaigner1_id,
          campaigner_payment: values.campaigner1_payment ? parseFloat(values.campaigner1_payment) : 0,
        });
      }
      
      if (values.campaigner2_id) {
        teamUpdates.push({
          client_id: client.id,
          campaigner_id: values.campaigner2_id,
          campaigner_payment: values.campaigner2_payment ? parseFloat(values.campaigner2_payment) : 0,
        });
      }
      
      if (values.campaigner3_id) {
        teamUpdates.push({
          client_id: client.id,
          campaigner_id: values.campaigner3_id,
          campaigner_payment: values.campaigner3_payment ? parseFloat(values.campaigner3_payment) : 0,
        });
      }
      
      if (values.campaigner4_id) {
        teamUpdates.push({
          client_id: client.id,
          campaigner_id: values.campaigner4_id,
          campaigner_payment: values.campaigner4_payment ? parseFloat(values.campaigner4_payment) : 0,
        });
      }

      // Delete existing team members
      await supabase
        .from("client_team")
        .delete()
        .eq("client_id", client.id);

      // Insert new team members
      if (teamUpdates.length > 0) {
        const { error: teamError } = await supabase
          .from("client_team")
          .insert(teamUpdates);

        if (teamError) throw teamError;
      }
    },
    onSuccess: () => {
      toast.success("הלקוח עודכן בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("שגיאה בעדכון הלקוח: " + error.message);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>עריכת לקוח: {client.name}</DialogTitle>
          <DialogDescription>
            עדכן את פרטי הלקוח, הוסף הערות וקישור לתיקייה
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="agency_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סוכנות *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר סוכנות" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background">
                      {agencies?.map((agency) => (
                        <SelectItem key={agency.id} value={agency.id}>
                          {agency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם הלקוח *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>טלפון</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>אימייל</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="folder_link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>קישור לתיקייה</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://drive.google.com/..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {isOwner && (
                <FormField
                  control={form.control}
                  name="retainer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ריטיינר (₪)</FormLabel>
                      <FormControl>
                        <Input {...field} type="number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="industry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>תעשייה</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isOwner && (
              <FormField
                control={form.control}
                name="monthly_budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>תקציב חודשי (₪)</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>אתר</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="https://example.com" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סטטוס</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background">
                      <SelectItem value="active">פעיל</SelectItem>
                      <SelectItem value="paused">מושהה</SelectItem>
                      <SelectItem value="ended">הסתיים</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold text-lg">קמפיינרים ותשלומים</h3>
              
              {[1, 2, 3, 4].map((num) => (
                <div key={num} className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name={`campaigner${num}_id` as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>קמפיינר {num}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || undefined}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="בחר קמפיינר" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-background z-50">
                            {campaigners?.map((campaigner) => (
                              <SelectItem key={campaigner.id} value={campaigner.id}>
                                {campaigner.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`campaigner${num}_payment` as any}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>תשלום (₪)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" placeholder="0" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>הערות</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={4} placeholder="הוסף הערות כאן..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                ביטול
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                )}
                שמור שינויים
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
