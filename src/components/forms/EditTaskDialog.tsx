import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useState } from "react";
import { Check, ChevronsUpDown, Send, FileText, MessageSquare, Settings, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const formSchema = z.object({
  title: z.string().min(1, "שם המשימה הוא שדה חובה"),
  notes: z.string().optional(),
  campaigner_id: z.string().min(1, "יש לבחור קמפיינר"),
  client_id: z.string().min(1, "יש לבחור לקוח"),
  due_date: z.string().optional(),
  status: z.enum(["open", "in_progress", "done"]),
  priority: z.enum(["low", "medium", "high"]),
});

interface EditTaskDialogProps {
  task: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditTaskDialog({ task, open, onOpenChange }: EditTaskDialogProps) {
  const [clientPopoverOpen, setClientPopoverOpen] = useState(false);
  const [newUpdate, setNewUpdate] = useState("");
  const [activeTab, setActiveTab] = useState("details");
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [editingUpdateContent, setEditingUpdateContent] = useState("");
  const queryClient = useQueryClient();
  const { userId } = useCurrentUser();

  const { data: campaigners } = useQuery({
    queryKey: ["campaigners"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigners")
        .select("*")
        .eq("active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: taskUpdates, refetch: refetchUpdates } = useQuery({
    queryKey: ["task-updates", task.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_updates")
        .select(`
          *,
          profiles:user_id (full_name, email)
        `)
        .eq("task_id", task.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!task.id && open,
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: task.title || "",
      notes: task.notes || "",
      campaigner_id: task.campaigner_id || "",
      client_id: task.client_id || "",
      due_date: task.due_date || "",
      status: task.status || "open",
      priority: task.priority || "medium",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: z.infer<typeof formSchema>) => {
      // Get agency_id from the selected client
      const selectedClient = clients?.find(c => c.id === values.client_id);
      if (!selectedClient?.agency_id) {
        throw new Error("הלקוח שנבחר לא משויך לסוכנות");
      }

      const { error } = await supabase
        .from("tasks")
        .update({
          title: values.title,
          notes: values.notes || null,
          campaigner_id: values.campaigner_id,
          client_id: values.client_id,
          agency_id: selectedClient.agency_id,
          due_date: values.due_date || null,
          status: values.status,
          priority: values.priority,
          task_type: "other",
        })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("המשימה עודכנה בהצלחה");
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`שגיאה בעדכון משימה: ${error.message}`);
    },
  });

  const addUpdateMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase
        .from("task_updates")
        .insert({
          task_id: task.id,
          user_id: userId,
          content,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchUpdates();
      setNewUpdate("");
      toast.success("העדכון נוסף בהצלחה");
    },
    onError: (error: Error) => {
      toast.error(`שגיאה בהוספת עדכון: ${error.message}`);
    },
  });

  const updateUpdateMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase
        .from("task_updates")
        .update({ content })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchUpdates();
      setEditingUpdateId(null);
      setEditingUpdateContent("");
      toast.success("העדכון עודכן בהצלחה");
    },
    onError: (error: Error) => {
      toast.error(`שגיאה בעדכון: ${error.message}`);
    },
  });

  const deleteUpdateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("task_updates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchUpdates();
      toast.success("העדכון נמחק בהצלחה");
    },
    onError: (error: Error) => {
      toast.error(`שגיאה במחיקת עדכון: ${error.message}`);
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    mutation.mutate(values);
  };

  const handleAddUpdate = () => {
    if (!newUpdate.trim()) return;
    addUpdateMutation.mutate(newUpdate);
  };

  const handleEditUpdate = (updateId: string, currentContent: string) => {
    setEditingUpdateId(updateId);
    setEditingUpdateContent(currentContent);
  };

  const handleSaveEdit = () => {
    if (!editingUpdateContent.trim() || !editingUpdateId) return;
    updateUpdateMutation.mutate({
      id: editingUpdateId,
      content: editingUpdateContent.trim(),
    });
  };

  const handleCancelEdit = () => {
    setEditingUpdateId(null);
    setEditingUpdateContent("");
  };

  const handleDeleteUpdate = (updateId: string) => {
    if (confirm("האם אתה בטוח שברצונך למחוק עדכון זה?")) {
      deleteUpdateMutation.mutate(updateId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>עריכת משימה</DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              פרטי משימה
            </TabsTrigger>
            <TabsTrigger value="updates" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              עדכונים
              {taskUpdates && taskUpdates.length > 0 && (
                <span className="ml-1 rounded-full bg-primary text-primary-foreground px-2 py-0.5 text-xs">
                  {taskUpdates.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="status" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              סטטוס
            </TabsTrigger>
          </TabsList>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="mt-6">
              
              {/* Tab 1: Details */}
              <TabsContent value="details" className="space-y-4 mt-0">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-right block">כותרת משימה</FormLabel>
                      <FormControl>
                        <Input {...field} className="text-right" />
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
                      <FormLabel className="text-right block">תיאור משימה</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={6} placeholder="הוסף תיאור למשימה..." className="text-right" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="campaigner_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-right block">קמפיינר אחראי</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="text-right">
                              <SelectValue placeholder="בחר קמפיינר" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-background z-50" align="end">
                            {campaigners?.map((campaigner) => (
                              <SelectItem key={campaigner.id} value={campaigner.id} className="text-right">
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
                    name="client_id"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="text-right block">לקוח</FormLabel>
                        <Popover open={clientPopoverOpen} onOpenChange={setClientPopoverOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "justify-between text-right",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                 {field.value
                                   ? clients?.find((client) => client.id === field.value)?.name
                                   : "בחר לקוח"}
                                 <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0 bg-background" align="start">
                            <Command>
                              <CommandInput placeholder="חפש לקוח..." />
                              <CommandList>
                                <CommandEmpty>לא נמצאו לקוחות</CommandEmpty>
                                <CommandGroup>
                                  {clients?.map((client) => (
                                    <CommandItem
                                      key={client.id}
                                      value={client.name}
                                      onSelect={() => {
                                        form.setValue("client_id", client.id);
                                        setClientPopoverOpen(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          field.value === client.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {client.name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              {/* Tab 2: Updates */}
              <TabsContent value="updates" className="space-y-4 mt-0">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">היסטוריית עדכונים</h4>
                    <span className="text-xs text-muted-foreground">
                      {taskUpdates?.length || 0} עדכונים
                    </span>
                  </div>

                  {/* Updates List */}
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {taskUpdates?.map((update: any) => (
                      <Card key={update.id} className="p-3">
                        {editingUpdateId === update.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={editingUpdateContent}
                              onChange={(e) => setEditingUpdateContent(e.target.value)}
                              rows={3}
                              className="w-full"
                            />
                             <div className="flex gap-2 justify-start">
                               <Button
                                 type="button"
                                 size="sm"
                                 onClick={handleSaveEdit}
                                 disabled={!editingUpdateContent.trim() || updateUpdateMutation.isPending}
                               >
                                 שמור
                               </Button>
                               <Button
                                 type="button"
                                 variant="ghost"
                                 size="sm"
                                 onClick={handleCancelEdit}
                               >
                                 ביטול
                               </Button>
                             </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground">
                                  {update.profiles?.full_name || update.profiles?.email || "משתמש"}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {format(new Date(update.created_at), "d בMMMM, HH:mm", { locale: he })}
                                </span>
                              </div>
                              <p className="text-sm whitespace-pre-wrap">
                                {update.content}
                              </p>
                            </div>
                            {update.user_id === userId && (
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleEditUpdate(update.id, update.content)}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => handleDeleteUpdate(update.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      </Card>
                    ))}
                    {(!taskUpdates || taskUpdates.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        אין עדכונים עדיין
                      </p>
                    )}
                  </div>

                   {/* Add New Update */}
                   <div className="flex gap-2 pt-4 border-t" dir="rtl">
                     <Button
                       type="button"
                       size="icon"
                       onClick={handleAddUpdate}
                       disabled={!newUpdate.trim() || addUpdateMutation.isPending}
                       className="self-end"
                     >
                       <Send className="h-4 w-4" />
                     </Button>
                     <Textarea
                       value={newUpdate}
                       onChange={(e) => setNewUpdate(e.target.value)}
                       placeholder="הוסף עדכון חדש..."
                       rows={3}
                       className="flex-1"
                       onKeyDown={(e) => {
                         if (e.key === "Enter" && e.ctrlKey) {
                           handleAddUpdate();
                         }
                       }}
                     />
                   </div>
                   <p className="text-xs text-muted-foreground text-right">
                     לחץ Ctrl+Enter לשליחה מהירה
                   </p>
                </div>
              </TabsContent>

              {/* Tab 3: Status */}
              <TabsContent value="status" className="space-y-4 mt-0">
                <FormField
                  control={form.control}
                  name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-right block">סטטוס משימה</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className={cn(
                          "border-0 text-white font-medium",
                          field.value === "open" && "bg-blue-400 hover:bg-blue-500",
                          field.value === "in_progress" && "bg-yellow-400 hover:bg-yellow-500",
                          field.value === "done" && "bg-green-400 hover:bg-green-500"
                        )}>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="open" className="text-blue-600 focus:text-blue-600 focus:bg-blue-50">פתוח</SelectItem>
                        <SelectItem value="in_progress" className="text-yellow-600 focus:text-yellow-600 focus:bg-yellow-50">בעבודה</SelectItem>
                        <SelectItem value="done" className="text-green-600 focus:text-green-600 focus:bg-green-50">הושלם</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-right block">דחיפות</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className={cn(
                          "border-0 text-white font-medium",
                          field.value === "high" && "bg-red-400 hover:bg-red-500",
                          field.value === "medium" && "bg-orange-400 hover:bg-orange-500",
                          field.value === "low" && "bg-purple-400 hover:bg-purple-500"
                        )}>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-background z-50">
                        <SelectItem value="high" className="text-red-600 focus:text-red-600 focus:bg-red-50">גבוה</SelectItem>
                        <SelectItem value="medium" className="text-orange-600 focus:text-orange-600 focus:bg-orange-50">בינוני</SelectItem>
                        <SelectItem value="low" className="text-purple-600 focus:text-purple-600 focus:bg-purple-50">נמוך</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="due_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-right block">תאריך יעד</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </TabsContent>

               <div className="flex justify-start gap-2 mt-6 pt-4 border-t">
                 <Button type="submit" disabled={mutation.isPending}>
                   {mutation.isPending ? "מעדכן..." : "עדכן משימה"}
                 </Button>
                 <Button
                   type="button"
                   variant="outline"
                   onClick={() => onOpenChange(false)}
                 >
                   ביטול
                 </Button>
               </div>
            </form>
          </Form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
