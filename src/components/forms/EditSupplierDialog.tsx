import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  phone: z.string().optional(),
  email: z.string().email("כתובת אימייל לא תקינה").optional().or(z.literal("")),
  folder_link: z.string().url("קישור לא תקין").optional().or(z.literal("")),
  notes: z.string().optional(),
});

interface EditSupplierDialogProps {
  supplier: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditSupplierDialog({ supplier, open, onOpenChange }: EditSupplierDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: supplier.name || "",
      type: supplier.type || "other",
      phone: supplier.phone || "",
      email: supplier.email || "",
      folder_link: supplier.folder_link || "",
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
          phone: values.phone || null,
          email: values.email || null,
          folder_link: values.folder_link || null,
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
