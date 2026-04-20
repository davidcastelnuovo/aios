import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Plus, X, Mail } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface EmailOption {
  email: string;
  label: string;
  icon?: string;
}

interface EmailRecipientsSelectorProps {
  options: EmailOption[];
  selectedEmails: string[];
  onChange: (emails: string[]) => void;
}

export function EmailRecipientsSelector({
  options,
  selectedEmails,
  onChange,
}: EmailRecipientsSelectorProps) {
  const [open, setOpen] = useState(false);
  const [manualEmail, setManualEmail] = useState("");

  // Filter out options without a valid email and dedupe by email,
  // otherwise multiple empty-email options all get toggled together.
  const validOptions = (() => {
    const seen = new Set<string>();
    const out: EmailOption[] = [];
    for (const opt of options) {
      const email = (opt.email || "").trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
      if (seen.has(email)) continue;
      seen.add(email);
      out.push({ ...opt, email });
    }
    return out;
  })();

  const toggleEmail = (email: string) => {
    if (selectedEmails.includes(email)) {
      onChange(selectedEmails.filter((e) => e !== email));
    } else {
      onChange([...selectedEmails, email]);
    }
  };

  const removeEmail = (email: string) => {
    onChange(selectedEmails.filter((e) => e !== email));
  };

  const addManualEmail = () => {
    const trimmed = manualEmail.trim();
    if (!trimmed) return;
    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return;
    if (!selectedEmails.includes(trimmed)) {
      onChange([...selectedEmails, trimmed]);
    }
    setManualEmail("");
  };

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-full justify-between text-xs font-normal"
          >
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Mail className="h-3 w-3" />
              {selectedEmails.length > 0
                ? `${selectedEmails.length} נמענים נבחרו`
                : "בחר נמענים..."}
            </span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start" dir="rtl">
          <ScrollArea className="max-h-[280px]">
            <div className="p-2 space-y-1">
              {validOptions.length === 0 && (
                <div className="text-xs text-muted-foreground px-2 py-3 text-center">
                  אין נמענים מהצוות
                </div>
              )}
              {validOptions.map((opt) => {
                const checked = selectedEmails.includes(opt.email);
                return (
                  <div
                    key={opt.email}
                    role="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleEmail(opt.email);
                    }}
                    className="flex items-start gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-xs"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleEmail(opt.email)}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-0.5 pointer-events-none"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {opt.icon} {opt.label}
                      </div>
                      <div className="text-muted-foreground truncate text-[10px]">
                        {opt.email}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
          <div className="border-t p-2 space-y-1.5 bg-muted/30">
            <div className="text-[10px] font-medium text-muted-foreground px-1">
              הוסף נמען ידנית
            </div>
            <div className="flex gap-1">
              <Input
                type="email"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addManualEmail();
                  }
                }}
                placeholder="example@email.com"
                className="h-7 text-xs flex-1"
              />
              <Button
                size="sm"
                variant="secondary"
                className="h-7 px-2"
                onClick={addManualEmail}
                disabled={!manualEmail.trim()}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {selectedEmails.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedEmails.map((email) => {
            const opt = options.find((o) => o.email === email);
            return (
              <Badge
                key={email}
                variant="secondary"
                className="text-[10px] gap-1 pr-1.5 pl-1 h-6"
              >
                <span className="truncate max-w-[180px]">
                  {opt ? `${opt.icon || ""} ${opt.label}` : email}
                </span>
                <button
                  type="button"
                  onClick={() => removeEmail(email)}
                  className="hover:bg-destructive/20 rounded p-0.5"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
