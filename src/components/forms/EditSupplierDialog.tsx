import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

const formSchema = z.object({
  name: z.string().min(1, "שם הספק נדרש"),
  type: z.enum(["campaigner", "media", "design", "creative", "dev", "other"]),
  related_campaigner_id: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("כתובת אימייל לא תקינה").optional().or(z.literal("")),
  folder_link: z.string().url("קישור לא תקין").optional().or(z.literal("")),
  payment_1: z.string().optional(),
  agency_id_1: z.string().optional(),
  payment_2: z.string().optional(),
  agency_id_2: z.string().optional(),
  payment_3: z.string().optional(),
  agency_id_3: z.string().optional(),
  notes: z.string().optional(),
});

interface EditSupplierDialogProps {
  supplier: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditSupplierDialog({ supplier, open, onOpenChange }: EditSupplierDialogProps) {
  const queryClient = useQueryClient();

  const { data: agencies } = useQuery({
    queryKey: ["agencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("status", "active")
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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: supplier.name || "",
      type: supplier.type || "other",
      related_campaigner_id: supplier.related_campaigner_id || "none",
      phone: supplier.phone || "",
      email: supplier.email || "",
      folder_link: supplier.folder_link || "",
      payment_1: supplier.payment_1?.toString() || "",
      agency_id_1: supplier.agency_id_1 || "",
      payment_2: supplier.payment_2?.toString() || "",
      agency_id_2: supplier.agency_id_2 || "",
      payment_3: supplier.payment_3?.toString() || "",
      agency_id_3: supplier.agency_id_3 || "",
      notes: supplier.notes || "",
    },
  });
  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      const { error } = await supabase
        .from("suppliers")
        .update({
          name: values.name,
          type: values.type,
          related_campaigner_id: (values.related_campaigner_id && values.related_campaigner_id !== "none") ? values.related_campaigner_id : null,
          phone: values.phone || null,
          email: values.email || null,
          folder_link: values.folder_link || null,
          payment_1: values.payment_1 ? parseFloat(values.payment_1) : null,
          agency_id_1: values.agency_id_1 || null,
          payment_2: values.payment_2 ? parseFloat(values.payment_2) : null,
          agency_id_2: values.agency_id_2 || null,
          payment_3: values.payment_3 ? parseFloat(values.payment_3) : null,
          agency_id_3: values.agency_id_3 || null,
          notes: values.notes || null,
        })
        .eq("id", supplier.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("הספק עודכן בהצלחה");
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error("שגיאה בעדכון הספק: " + error.message);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>עריכת ספק: {supplier.name}</DialogTitle>
          <DialogDescription>
            עדכן את פרטי הספק, הוסף הערות וקישור לתיקייה
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם הספק *</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>סוג ספק *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background">
                      <SelectItem value="campaigner">קמפיינר</SelectItem>
                      <SelectItem value="media">מדיה</SelectItem>
                      <SelectItem value="design">עיצוב</SelectItem>
                      <SelectItem value="creative">קריאייטיב</SelectItem>
                      <SelectItem value="dev">פיתוח</SelectItem>
                      <SelectItem value="other">אחר</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="related_campaigner_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>קמפיינר קשור</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר קמפיינר" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-background">
                      <SelectItem value="none">ללא קמפיינר</SelectItem>
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

            <div className="border-t pt-4 mt-4">
              <h3 className="text-sm font-semibold mb-4">תשלומים</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                  <FormField
                    control={form.control}
                    name="payment_1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>תשלום 1 (₪)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="agency_id_1"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>סוכנות</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                  <FormField
                    control={form.control}
                    name="payment_2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>תשלום 2 (₪)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="agency_id_2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>סוכנות</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                </div>

                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                  <FormField
                    control={form.control}
                    name="payment_3"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>תשלום 3 (₪)</FormLabel>
                        <FormControl>
                          <Input {...field} type="number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="agency_id_3"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>סוכנות</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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
                </div>
              </div>
            </div>

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
