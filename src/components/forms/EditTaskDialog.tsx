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
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Send, FileText, MessageSquare, Settings, Pencil, Trash2, Upload, X, File, Image as ImageIcon } from "lucide-react";
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
  priority: z.number().min(1).max(10),
});

// Component to handle async signed URL loading
function AttachmentPreview({ file }: { file: any }) {
  const [signedUrl, setSignedUrl] = useState<string>('');

  useEffect(() => {
    const fetchSignedUrl = async () => {
      const { data, error } = await supabase.storage
        .from('task-attachments')
        .createSignedUrl(file.path, 3600); // 1 hour expiry
      
      if (error) {
        console.error('Error creating signed URL:', error);
        return;
      }
      setSignedUrl(data.signedUrl);
    };

    fetchSignedUrl();
  }, [file.path]);

  if (!signedUrl) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md text-sm animate-pulse">
        <File className="h-4 w-4" />
        <span>טוען...</span>
      </div>
    );
  }

  if (file.type?.startsWith('image/')) {
    return (
      <a
        href={signedUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-md overflow-hidden border border-border hover:opacity-80 transition-opacity"
      >
        <img 
          src={signedUrl} 
          alt={file.name}
          className="h-24 w-auto object-cover"
        />
      </a>
    );
  }

  return (
    <a
      href={signedUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md hover:bg-muted/80 transition-colors text-sm"
    >
      <File className="h-4 w-4" />
      <span className="truncate max-w-[150px]">{file.name}</span>
    </a>
  );
}

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
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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
      priority: task.priority || 5,
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

  const uploadFiles = async (files: File[]): Promise<{ name: string; path: string; type: string; size: number }[]> => {
    const uploadPromises = files.map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${task.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      return {
        name: file.name,
        path: fileName,
        type: file.type,
        size: file.size,
      };
    });

    return Promise.all(uploadPromises);
  };

  const addUpdateMutation = useMutation({
    mutationFn: async ({ content, attachments }: { content: string; attachments: any[] }) => {
      const { error } = await supabase
        .from("task_updates")
        .insert({
          task_id: task.id,
          user_id: userId,
          content,
          attachments,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchUpdates();
      setNewUpdate("");
      setUploadedFiles([]);
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

  const handleAddUpdate = async () => {
    if (!newUpdate.trim() && uploadedFiles.length === 0) return;
    
    setIsUploading(true);
    try {
      const attachments = uploadedFiles.length > 0 
        ? await uploadFiles(uploadedFiles)
        : [];
      
      addUpdateMutation.mutate({
        content: newUpdate,
        attachments,
      });
    } catch (error: any) {
      toast.error(`שגיאה בהעלאת קבצים: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf';
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
      
      if (!isValidType) {
        toast.error(`${file.name}: רק תמונות ו-PDF מותרים`);
        return false;
      }
      if (!isValidSize) {
        toast.error(`${file.name}: הקובץ גדול מדי (מקסימום 10MB)`);
        return false;
      }
      return true;
    });
    
    setUploadedFiles(prev => [...prev, ...validFiles]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const validFiles = files.filter(file => {
      const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf';
      const isValidSize = file.size <= 10 * 1024 * 1024;
      
      if (!isValidType) {
        toast.error(`${file.name}: רק תמונות ו-PDF מותרים`);
        return false;
      }
      if (!isValidSize) {
        toast.error(`${file.name}: הקובץ גדול מדי (מקסימום 10MB)`);
        return false;
      }
      return true;
    });
    
    setUploadedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
          if (!isValidSize) {
            toast.error(`הקובץ גדול מדי (מקסימום 10MB)`);
            continue;
          }
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      setUploadedFiles(prev => [...prev, ...files]);
      toast.success(`${files.length} תמונות נוספו`);
    }
  };

  const getFileUrl = async (path: string) => {
    const { data, error } = await supabase.storage
      .from('task-attachments')
      .createSignedUrl(path, 3600); // 1 hour expiry
    
    if (error) {
      console.error('Error creating signed URL:', error);
      return '';
    }
    return data.signedUrl;
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
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground">
                                  {update.profiles?.full_name || update.profiles?.email || "משתמש"}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {format(new Date(update.created_at), "d בMMMM, HH:mm", { locale: he })}
                                </span>
                              </div>
                              {update.content && (
                                <p className="text-sm whitespace-pre-wrap">
                                  {update.content}
                                </p>
                              )}
                              {update.attachments && Array.isArray(update.attachments) && update.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {update.attachments.map((file: any, idx: number) => (
                                    <AttachmentPreview key={idx} file={file} />
                                  ))}
                                </div>
                              )}
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
                   <div className="space-y-3 pt-4 border-t">
                     {/* File Upload Area */}
                     <div
                       className={cn(
                         "border-2 border-dashed rounded-lg p-4 transition-colors",
                         isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25",
                         "hover:border-primary/50"
                       )}
                       onDragOver={handleDragOver}
                       onDragLeave={handleDragLeave}
                       onDrop={handleDrop}
                     >
                       <div className="flex flex-col items-center gap-2 text-center">
                         <Upload className="h-8 w-8 text-muted-foreground" />
                         <p className="text-sm text-muted-foreground">
                           גרור קבצים לכאן או
                           <label className="text-primary cursor-pointer hover:underline mr-1">
                             בחר קבצים
                             <input
                               type="file"
                               className="hidden"
                               multiple
                               accept="image/*,.pdf"
                               onChange={handleFileSelect}
                             />
                           </label>
                         </p>
                         <p className="text-xs text-muted-foreground">
                           תמונות או PDF עד 10MB
                         </p>
                       </div>
                     </div>

                     {/* Uploaded Files Preview */}
                     {uploadedFiles.length > 0 && (
                       <div className="flex flex-wrap gap-2">
                         {uploadedFiles.map((file, index) => (
                           <div
                             key={index}
                             className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md text-sm"
                           >
                             {file.type.startsWith('image/') ? (
                               <ImageIcon className="h-4 w-4" />
                             ) : (
                               <File className="h-4 w-4" />
                             )}
                             <span className="truncate max-w-[150px]">{file.name}</span>
                             <Button
                               type="button"
                               variant="ghost"
                               size="icon"
                               className="h-5 w-5"
                               onClick={() => removeFile(index)}
                             >
                               <X className="h-3 w-3" />
                             </Button>
                           </div>
                         ))}
                       </div>
                     )}

                     <div className="flex gap-2" dir="rtl">
                       <Button
                         type="button"
                         size="icon"
                         onClick={handleAddUpdate}
                         disabled={(!newUpdate.trim() && uploadedFiles.length === 0) || addUpdateMutation.isPending || isUploading}
                         className="self-end"
                       >
                         <Send className="h-4 w-4" />
                       </Button>
                        <Textarea
                          value={newUpdate}
                          onChange={(e) => setNewUpdate(e.target.value)}
                          onPaste={handlePaste}
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
                render={({ field }) => {
                  const getPriorityColor = (priority: number) => {
                    const hue = 240 - ((priority - 1) / 9) * 240;
                    return `hsl(${hue}, 70%, 50%)`;
                  };
                  
                  const getPriorityText = (priority: number) => {
                    if (priority >= 8) return "דחיפות גבוהה";
                    if (priority >= 5) return "דחיפות בינונית";
                    return "דחיפות נמוכה";
                  };

                  return (
                    <FormItem>
                      <FormLabel className="text-right block">דחיפות</FormLabel>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">{getPriorityText(field.value)}</span>
                          <span className="text-sm font-medium" style={{ color: getPriorityColor(field.value) }}>
                            {field.value}/10
                          </span>
                        </div>
                        <div style={{ ['--slider-color' as any]: getPriorityColor(field.value) }}>
                          <Slider
                            value={[field.value]}
                            onValueChange={(value) => field.onChange(value[0])}
                            min={1}
                            max={10}
                            step={1}
                            className="cursor-pointer [&_[role=slider]]:border-[var(--slider-color)] [&_.bg-primary]:bg-[var(--slider-color)]"
                            style={{ ['--slider-color' as any]: getPriorityColor(field.value) }}
                          />
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
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
            </form>
          </Form>

          {/* Buttons outside tabs but visible always */}
          <div className="flex justify-start gap-2 mt-6 pt-4 border-t">
            <Button 
              type="button"
              onClick={() => form.handleSubmit(onSubmit)()}
              disabled={mutation.isPending}
            >
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
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
