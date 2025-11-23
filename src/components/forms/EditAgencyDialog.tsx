import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
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
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTerminology } from "@/hooks/useTerminology";

const formSchema = z.object({
  name: z.string().min(1, "שם הסוכנות הוא שדה חובה"),
  contact_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("כתובת אימייל לא תקינה").optional().or(z.literal("")),
  folder_link: z.string().url("קישור לא תקין").optional().or(z.literal("")),
  start_date: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface EditAgencyDialogProps {
  agency: {
    id: string;
    name: string;
    contact_name?: string | null;
    phone?: string | null;
    email?: string | null;
    folder_link?: string | null;
    start_date?: string | null;
    notes?: string | null;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditAgencyDialog({ agency, open, onOpenChange }: EditAgencyDialogProps) {
  const queryClient = useQueryClient();
  const { t } = useTerminology();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: agency.name || "",
      contact_name: agency.contact_name || "",
      phone: agency.phone || "",
      email: agency.email || "",
      folder_link: agency.folder_link || "",
      start_date: agency.start_date || "",
      notes: agency.notes || "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: agency.name || "",
        contact_name: agency.contact_name || "",
        phone: agency.phone || "",
        email: agency.email || "",
        folder_link: agency.folder_link || "",
        start_date: agency.start_date || "",
        notes: agency.notes || "",
      });
    }
  }, [open, agency, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const { error } = await supabase
        .from("agencies")
        .update({
          name: values.name,
          contact_name: values.contact_name || null,
          phone: values.phone || null,
          email: values.email || null,
          folder_link: values.folder_link || null,
          start_date: values.start_date || null,
          notes: values.notes || null,
        })
        .eq("id", agency.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${t('agency')} עודכנה בהצלחה`);
      queryClient.invalidateQueries({ queryKey: ["agencies-list"] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`שגיאה בעדכון ${t('agency')}: ` + error.message);
    },
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ערוך {t('agency')}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם ה{t('agency')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contact_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם איש קשר</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="folder_link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>קישור לתיקיה</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="start_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>תאריך התחלה</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
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
                    <Textarea {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending ? "מעדכן..." : "עדכן סוכנות"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
