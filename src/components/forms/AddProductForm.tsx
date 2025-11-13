import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCurrentTenant } from "@/hooks/useCurrentTenant";

const formSchema = z.object({
  name: z.string().min(1, "שם המוצר הוא שדה חובה"),
  description: z.string().optional(),
  price: z.string().min(1, "מחיר המוצר הוא שדה חובה"),
  active: z.boolean().default(true),
  agency_id: z.string().optional(),
});

interface AddProductFormProps {
  onSuccess: () => void;
}

export default function AddProductForm({ onSuccess }: AddProductFormProps) {
  const queryClient = useQueryClient();
  const { tenantId } = useCurrentTenant();

  // Fetch owned agencies
  const { data: agencies } = useQuery({
    queryKey: ["owned-agencies", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("agencies")
        .select("id, name")
        .eq("tenant_id", tenantId)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      price: "",
      active: true,
      agency_id: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      if (!tenantId) throw new Error("לא נמצא tenant_id");
      
      const { error } = await supabase.from("products").insert({
        name: values.name,
        description: values.description || null,
        price: parseFloat(values.price),
        active: values.active,
        tenant_id: tenantId,
        agency_id: values.agency_id || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("המוצר נוצר בהצלחה");
      form.reset();
      onSuccess();
    },
    onError: (error) => {
      toast.error("שגיאה ביצירת המוצר");
      console.error(error);
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    createMutation.mutate(values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>שם המוצר *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>מחיר *</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="agency_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>סוכנות (אופציונלי)</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר סוכנות או השאר כללי" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="">כללי (ללא סוכנות)</SelectItem>
                  {agencies?.map((agency: any) => (
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
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>תיאור המוצר</FormLabel>
              <FormControl>
                <Textarea {...field} rows={3} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="active"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">סטטוס</FormLabel>
                <div className="text-sm text-muted-foreground">
                  האם המוצר פעיל ונגיש לבחירה?
                </div>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={onSuccess}>
            ביטול
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "שומר..." : "שמור מוצר"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
