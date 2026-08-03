import {
  type ChangeEvent,
  type FocusEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/cn.ts";
import { Button } from "@/components/ui/button.tsx";
import { Calendar } from "@/components/ui/calendar.tsx";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group.tsx";
import {
  Popover,
  PopoverPopup,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { useFormatters } from "./use-formatters.ts";

export type DateFormat = "yyyy-mm-dd" | "dd-mm-yyyy" | "mm-dd-yyyy";
const SEPARATOR = "-";

/** Derives the date format string based on local ordering rules */
function deriveDateFormatFromLocale(locale: string): DateFormat {
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const firstType = parts.find((p) =>
      ["year", "month", "day"].includes(p.type)
    )?.type;

    if (firstType === "month") return "mm-dd-yyyy";
    if (firstType === "day") return "dd-mm-yyyy";
  } catch {
    // Fallback if invalid locale string
  }
  return "yyyy-mm-dd";
}

function formatDate(date: Date | undefined, format: DateFormat): string {
  if (!date || isNaN(date.getTime())) return "";

  const y = String(date.getFullYear());
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");

  return format === "dd-mm-yyyy"
    ? `${d}${SEPARATOR}${m}${SEPARATOR}${y}`
    : format === "mm-dd-yyyy"
    ? `${m}${SEPARATOR}${d}${SEPARATOR}${y}`
    : `${y}${SEPARATOR}${m}${SEPARATOR}${d}`;
}

function parseDate(dateStr: string, format: DateFormat): Date | undefined {
  if (!dateStr || dateStr.length !== 10) return undefined;

  const match = dateStr.match(/^(\d{2,4})-(\d{2})-(\d{2,4})$/);
  if (!match) return undefined;

  let y = 0, m = 0, d = 0;

  if (format === "dd-mm-yyyy") {
    [, d, m, y] = match.map(Number);
  } else if (format === "mm-dd-yyyy") {
    [, m, d, y] = match.map(Number);
  } else {
    [, y, m, d] = match.map(Number);
  }

  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 &&
      date.getDate() === d
    ? date
    : undefined;
}

/** Formats a digit sequence into date pattern masks */
function formatRawDigits(digits: string, format: DateFormat): string {
  const clean = digits.replace(/\D/g, "");
  const isYearFirst = format === "yyyy-mm-dd";

  const slices = isYearFirst
    ? [clean.slice(0, 4), clean.slice(4, 6), clean.slice(6, 8)]
    : [clean.slice(0, 2), clean.slice(2, 4), clean.slice(4, 8)];

  return slices.filter(Boolean).join(SEPARATOR);
}

export interface InputDateProps {
  name?: string;
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  onBlur?: () => void;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
  locale?: string;
}

export function InputDate({
  name,
  value,
  onChange,
  onBlur,
  className,
  disabled = false,
  readOnly = false,
  locale = "en-US",
}: InputDateProps) {
  const dateFormat = useMemo(() => deriveDateFormatFromLocale(locale), [
    locale,
  ]);
  const formatters = useFormatters(locale);

  const [inputValue, setInputValue] = useState(() =>
    formatDate(value, dateFormat)
  );
  const [month, setMonth] = useState<Date>(() => value || new Date());
  const [isOpen, setIsOpen] = useState(false);

  const lastValidValueRef = useRef<string>(formatDate(value, dateFormat));

  // Sync state with incoming external `value` or `locale` change
  useEffect(() => {
    const formatted = formatDate(value, dateFormat);
    setInputValue(formatted);
    lastValidValueRef.current = formatted;
    if (value) setMonth(value);
  }, [value, dateFormat]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = formatRawDigits(raw, dateFormat);

    setInputValue(formatted);

    const parsedDate = parseDate(formatted, dateFormat);
    if (parsedDate) {
      lastValidValueRef.current = formatted;
      setMonth(parsedDate);
      onChange?.(parsedDate);
    } else if (formatted.length === 0) {
      lastValidValueRef.current = "";
      onChange?.(undefined);
    }
  };

  const handleSelect = (selectedDate: Date | undefined) => {
    const formatted = formatDate(selectedDate, dateFormat);
    setInputValue(formatted);
    lastValidValueRef.current = formatted;

    if (selectedDate) {
      setMonth(selectedDate);
    }
    onChange?.(selectedDate);
  };

  const handleInputBlur = (e: FocusEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const isValid = val.length === 10 && parseDate(val, dateFormat);

    // Reset back to last valid formatted date on invalid entries
    if (val.length > 0 && !isValid) {
      setInputValue(lastValidValueRef.current);
    }

    if (!isOpen) onBlur?.();
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) onBlur?.();
  };

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <InputGroup
        className={cn(
          "has-read-only:border-transparent",
          disabled && "opacity-50 pointer-events-none",
          className,
        )}
      >
        <InputGroupInput
          aria-label="Select date"
          type="text"
          inputMode="numeric"
          placeholder={dateFormat}
          name={name}
          value={inputValue}
          disabled={disabled}
          readOnly={readOnly}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onClick={(e) => e.stopPropagation()}
        />
        <InputGroupAddon>
          <PopoverTrigger
            aria-label="Toggle calendar popover"
            render={<Button size="icon-xs" variant="ghost" />}
          >
            <CalendarIcon aria-hidden="true" />
          </PopoverTrigger>
        </InputGroupAddon>
      </InputGroup>
      <PopoverPopup align="start" alignOffset={-4} sideOffset={8}>
        <Calendar
          formatters={formatters}
          month={month}
          onMonthChange={setMonth}
          onSelect={handleSelect}
          selected={value}
          mode="single"
        />
      </PopoverPopup>
    </Popover>
  );
}
