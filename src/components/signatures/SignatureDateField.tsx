import { useState } from "react";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatSignatureDate, parseSignatureDate } from "@/lib/signatureDate";

interface SignatureDateFieldProps {
  value: string;
  onChange: (value: string) => void;
  onCommit?: () => void;
  label: string;
  required?: boolean;
  fontSize?: number;
  className?: string;
}

/** Calendar popover. Native type=date with dir=rtl reverses the segments and often saves nothing. */
export function SignatureDateField({
  value,
  onChange,
  onCommit,
  label,
  required,
  fontSize,
  className,
}: SignatureDateFieldProps) {
  const [open, setOpen] = useState(false);
  const selected = parseSignatureDate(value);
  const display = value ? formatSignatureDate(value) : required ? `${label} *` : label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          dir="ltr"
          aria-label={label}
          className={`flex h-full w-full items-center justify-center rounded-sm border border-primary bg-white/95 px-1 leading-none ${className ?? ""}`}
          style={{ fontSize }}
        >
          <span className={value ? "text-foreground" : "text-primary"}>{display}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="center">
        <Calendar
          mode="single"
          locale={he}
          selected={selected}
          onSelect={(date) => {
            if (!date) return;
            onChange(format(date, "dd/MM/yyyy"));
            setOpen(false);
            onCommit?.();
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
