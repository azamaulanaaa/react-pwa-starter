import { type FocusEvent, useEffect, useRef, useState } from "react";
import type * as React from "react";
import { CalendarIcon } from "lucide-react";
import type { Locale } from "react-day-picker";

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

/**
 * Derives the date format ("yyyy-mm-dd" | "dd-mm-yyyy" | "mm-dd-yyyy") from a locale.
 * Uses Intl.DateTimeFormat to detect whether year, month, or day comes first.
 */
function deriveDateFormatFromLocale(localeProp?: string | Locale): DateFormat {
  let localeCode = "en-US";
  if (typeof localeProp === "string") {
    localeCode = localeProp;
  } else if (
    localeProp &&
    typeof localeProp === "object" &&
    "code" in localeProp
  ) {
    localeCode = (localeProp as { code?: string }).code || "en-US";
  }

  try {
    const dtf = new Intl.DateTimeFormat(localeCode, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = dtf.formatToParts(new Date(2026, 11, 22));
    const firstType = parts.find(
      (p) => p.type === "year" || p.type === "month" || p.type === "day",
    )?.type;

    if (firstType === "year") {
      return "yyyy-mm-dd";
    }
    if (firstType === "month") {
      return "mm-dd-yyyy";
    }
    if (firstType === "day") {
      return "dd-mm-yyyy";
    }
  } catch {
    // fallback
  }

  return "yyyy-mm-dd";
}

function formatDate(date: Date | undefined, format: DateFormat): string {
  if (!date) return "";
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  switch (format) {
    case "dd-mm-yyyy":
      return `${day}${SEPARATOR}${month}${SEPARATOR}${year}`;
    case "mm-dd-yyyy":
      return `${month}${SEPARATOR}${day}${SEPARATOR}${year}`;
    case "yyyy-mm-dd":
    default:
      return `${year}${SEPARATOR}${month}${SEPARATOR}${day}`;
  }
}

function parseDate(dateStr: string, format: DateFormat): Date | undefined {
  if (!dateStr || dateStr.length !== 10) return undefined;

  let year: number;
  let month: number;
  let day: number;

  if (format === "dd-mm-yyyy") {
    const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!match) return undefined;
    day = parseInt(match[1], 10);
    month = parseInt(match[2], 10) - 1;
    year = parseInt(match[3], 10);
  } else if (format === "mm-dd-yyyy") {
    const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!match) return undefined;
    month = parseInt(match[1], 10) - 1;
    day = parseInt(match[2], 10);
    year = parseInt(match[3], 10);
  } else {
    // yyyy-mm-dd
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return undefined;
    year = parseInt(match[1], 10);
    month = parseInt(match[2], 10) - 1;
    day = parseInt(match[3], 10);
  }

  const date = new Date(year, month, day);
  if (
    date.getFullYear() === year &&
    date.getMonth() === month &&
    date.getDate() === day
  ) {
    return date;
  }

  return undefined;
}

/**
 * Formats a raw digit string into the specified date format as the user types.
 */
function formatRawDigits(digits: string, format: DateFormat): string {
  const cleaned = digits.replace(/[^\d]/g, "");
  const parts: string[] = [];

  if (format === "dd-mm-yyyy" || format === "mm-dd-yyyy") {
    if (cleaned.length > 0) parts.push(cleaned.slice(0, 2));
    if (cleaned.length > 2) parts.push(cleaned.slice(2, 4));
    if (cleaned.length > 4) parts.push(cleaned.slice(4, 8));
  } else {
    // yyyy-mm-dd
    if (cleaned.length > 0) parts.push(cleaned.slice(0, 4));
    if (cleaned.length > 4) parts.push(cleaned.slice(4, 6));
    if (cleaned.length > 6) parts.push(cleaned.slice(6, 8));
  }

  return parts.join(SEPARATOR);
}

export type InputDateProps = {
  name?: string;
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  onBlur?: () => void;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
  locale?: string;
};

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
  const dateFormat = deriveDateFormatFromLocale(locale);
  const formatters = useFormatters(locale);

  const [inputValue, setInputValue] = useState<string>(
    formatDate(value, dateFormat),
  );
  const [month, setMonth] = useState<Date>(value || new Date());
  const [isOpen, setIsOpen] = useState(false);
  const lastValidValueRef = useRef<string>(formatDate(value, dateFormat));
  const cursorPosRef = useRef<number | null>(null);

  useEffect(() => {
    const formatted = formatDate(value, dateFormat);
    setInputValue(formatted);
    lastValidValueRef.current = formatted;
    if (value) setMonth(value);
  }, [value, dateFormat]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const prevCursor = e.target.selectionStart ?? raw.length;

    const digitsOnly = raw.replace(/[^\d]/g, "");
    const formatted = formatRawDigits(digitsOnly, dateFormat);

    // Auto-insert dash cursor adjustment
    if (digitsOnly.length > prevCursor) {
      if (dateFormat === "dd-mm-yyyy" || dateFormat === "mm-dd-yyyy") {
        if (digitsOnly.length === 2 || digitsOnly.length === 4) {
          cursorPosRef.current = prevCursor + 1;
        }
      } else {
        if (digitsOnly.length === 4 || digitsOnly.length === 6) {
          cursorPosRef.current = prevCursor + 1;
        }
      }
    }

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

    requestAnimationFrame(() => {
      const input = e.target as HTMLInputElement;
      if (cursorPosRef.current !== null) {
        const pos = Math.min(cursorPosRef.current, formatted.length);
        input.setSelectionRange(pos, pos);
        cursorPosRef.current = null;
      }
    });
  };

  const handleSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      onChange?.(selectedDate);
      const formatted = formatDate(selectedDate, dateFormat);
      setInputValue(formatted);
      lastValidValueRef.current = formatted;
      setMonth(selectedDate);
    } else {
      setInputValue("");
      lastValidValueRef.current = "";
      onChange?.(undefined);
    }
  };

  const handleInputBlur = (e: FocusEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.length > 0 && val.length < 10) {
      setInputValue(lastValidValueRef.current);
    } else if (val.length === 10 && !parseDate(val, dateFormat)) {
      setInputValue(lastValidValueRef.current);
    }

    if (!isOpen) {
      onBlur?.();
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      onBlur?.();
    }
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
            render={
              <Button aria-label="Select date" size="icon-xs" variant="ghost" />
            }
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
        />
      </PopoverPopup>
    </Popover>
  );
}
