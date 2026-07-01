import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { ptBR } from "date-fns/locale";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export function parseLocalDate(str: string): Date {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

interface DatePickerFieldProps {
  value: string;
  onChange: (date: string) => void;
  onBlur?: (date: string) => void;
  label?: string;
  error?: string | null;
  warning?: string | null;
  disabled?: boolean;
  disablePast?: boolean;
  placeholder?: string;
  size?: "sm" | "default";
}

export function DatePickerField({
  value,
  onChange,
  onBlur,
  label,
  error,
  warning,
  disabled = false,
  disablePast = false,
  placeholder = "Selecionar data",
  size = "default",
}: DatePickerFieldProps) {
  const [open, setOpen] = useState(false);
  const parsed = value ? parseLocalDate(value) : undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-1">
      {label && (
        <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal text-sm",
              size === "sm" ? "h-8" : "h-9",
              !parsed && "text-muted-foreground",
              error && "border-destructive focus-visible:ring-destructive",
            )}
          >
            <CalendarIcon className="h-4 w-4 mr-2 opacity-60" />
            {parsed ? format(parsed, "dd/MM/yyyy", { locale: ptBR }) : placeholder}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
          <Calendar
            mode="single"
            selected={parsed}
            onSelect={(d) => {
              if (!d) return;
              const str = format(d, "yyyy-MM-dd");
              onChange(str);
              onBlur?.(str);
              setOpen(false);
            }}
            locale={ptBR}
            disabled={disablePast ? (d) => d < today : undefined}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      {error && <p className="text-[11px] text-destructive mt-0.5">{error}</p>}
      {!error && warning && (
        <p className="text-[11px] text-yellow-600 dark:text-yellow-400 mt-0.5">{warning}</p>
      )}
    </div>
  );
}