import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface AddFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableId: string;
}

const FIELD_TYPES = [
  { value: 'text', label: 'טקסט' },
  { value: 'long_text', label: 'טקסט ארוך' },
  { value: 'number', label: 'מספר' },
  { value: 'date', label: 'תאריך' },
  { value: 'datetime', label: 'תאריך ושעה' },
  { value: 'checkbox', label: 'תיבת סימון' },
  { value: 'single_select', label: 'בחירה יחידה' },
  { value: 'multi_select', label: 'בחירה מרובה' },
  { value: 'email', label: 'אימייל' },
  { value: 'phone', label: 'טלפון' },
  { value: 'url', label: 'קישור' },
];

export function AddFieldDialog({ open, onOpenChange, tableId }: AddFieldDialogProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [type, setType] = useState("text");
  const [isRequired, setIsRequired] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [options, setOptions] = useState("");

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('crm-fields', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: data,
      });

      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-fields', tableId] });
      toast.success('השדה נוצר בהצלחה');
      handleClose();
    },
    onError: (error) => {
      toast.error('שגיאה ביצירת השדה: ' + error.message);
    },
  });

  const handleNameChange = (value: string) => {
    setName(value);
    // Auto-generate key from name
    const keyValue = value
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '');
    setKey(keyValue);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !key.trim()) {
      toast.error('נא למלא את שם השדה');
      return;
    }

    const config: any = {};
    
    // Add options for select fields
    if ((type === 'single_select' || type === 'multi_select') && options.trim()) {
      config.options = options.split('\n').filter(o => o.trim());
    }

    createMutation.mutate({
      table_id: tableId,
      name,
      key,
      type,
      is_required: isRequired,
      is_visible: isVisible,
      config,
    });
  };

  const handleClose = () => {
    setName("");
    setKey("");
    setType("text");
    setIsRequired(false);
    setIsVisible(true);
    setOptions("");
    onOpenChange(false);
  };

  const showOptionsInput = type === 'single_select' || type === 'multi_select';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>הוספת שדה חדש</DialogTitle>
          <DialogDescription>
            הגדר את המאפיינים של השדה החדש
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="field-name">שם השדה *</Label>
            <Input
              id="field-name"
              placeholder="לדוגמה: שם הפרויקט"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-key">מפתח (Key) *</Label>
            <Input
              id="field-key"
              placeholder="project_name"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
              pattern="[a-z0-9_]+"
            />
            <p className="text-xs text-muted-foreground">
              מזהה ייחודי לשדה (אנגלית קטנה, מספרים וקו תחתון בלבד)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="field-type">סוג השדה *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="field-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((ft) => (
                  <SelectItem key={ft.value} value={ft.value}>
                    {ft.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showOptionsInput && (
            <div className="space-y-2">
              <Label htmlFor="options">אפשרויות (שורה אחת לכל אפשרות)</Label>
              <Textarea
                id="options"
                placeholder="אפשרות 1&#10;אפשרות 2&#10;אפשרות 3"
                value={options}
                onChange={(e) => setOptions(e.target.value)}
                rows={4}
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label htmlFor="is-required">שדה חובה</Label>
            <Switch
              id="is-required"
              checked={isRequired}
              onCheckedChange={setIsRequired}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="is-visible">גלוי</Label>
            <Switch
              id="is-visible"
              checked={isVisible}
              onCheckedChange={setIsVisible}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              ביטול
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'יוצר...' : 'הוסף שדה'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}