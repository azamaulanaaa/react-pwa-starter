import {
  type ChangeEvent,
  type FocusEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils/cn.ts";
import { useTranslation } from "@/components/context/translation.tsx";
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
import { useFormatters } from "@/components/input/date/use-formatters.ts";

export type DateFormat = "yyyy-mm-dd" | "dd-mm-yyyy" | "mm-dd-yyyy";
const SEPARATOR = "-";

/** Selects the date format string from the ordering rules of the locale */
function deriveDateFormatFromLocale(locale: string): DateFormat {
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const firstType = parts.find((p) =>
      ["year", "month", "day"].includes(p.type),
    )?.type;

    if (firstType === "month") return "mm-dd-yyyy";
    if (firstType === "day") return "dd-mm-yyyy";
  } catch {
    // The code uses the fallback format if the locale string is invalid
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

  let y = 0,
    m = 0,
    d = 0;

  if (format === "dd-mm-yyyy") {
    [, d, m, y] = match.map(Number);
  } else if (format === "mm-dd-yyyy") {
    [, m, d, y] = match.map(Number);
  } else {
    [, y, m, d] = match.map(Number);
  }

  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y &&
    date.getMonth() === m - 1 &&
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
  id?: string;
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  onBlur?: () => void;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
  locale?: string;
  invalid?: boolean;
  error?: string;
  "aria-describedby"?: string;
}

export function InputDate({
  name,
  id,
  value,
  onChange,
  onBlur,
  className,
  disabled = false,
  readOnly = false,
  locale = "en-US",
  invalid = false,
  error,
  "aria-describedby": ariaDescribedBy,
}: InputDateProps) {
  const { t } = useTranslation();
  const dateFormat = useMemo(
    () => deriveDateFormatFromLocale(locale),
    [locale],
  );
  const formatters = useFormatters(locale);
  const errorId = useId();
  const isInvalid = invalid || Boolean(error);
  const describedBy =
    [ariaDescribedBy, error ? errorId : undefined].filter(Boolean).join(" ") ||
    undefined;

  const [inputValue, setInputValue] = useState(() =>
    formatDate(value, dateFormat),
  );
  const [month, setMonth] = useState<Date>(() => value || new Date());
  const [isOpen, setIsOpen] = useState(false);

  const lastValidValueRef = useRef<string>(formatDate(value, dateFormat));

  // Updates the state from an external `value` or `locale` change
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
    if (readOnly) return;

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

    // The code resets the input to the last valid date if the entry is invalid
    if (val.length > 0 && !isValid) {
      setInputValue(lastValidValueRef.current);
    }

    if (!isOpen) onBlur?.();
  };

  const handleOpenChange = (open: boolean) => {
    if (readOnly) return;

    setIsOpen(open);
    if (!open) onBlur?.();
  };

  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      <Popover open={isOpen} onOpenChange={handleOpenChange}>
        <InputGroup className="has-read-only:border-transparent">
          <InputGroupInput
            aria-describedby={describedBy}
            aria-invalid={isInvalid || undefined}
            aria-label={t("input_date_label")}
            className="tabular-nums"
            disabled={disabled}
            id={id}
            inputMode="numeric"
            name={name}
            onBlur={handleInputBlur}
            onChange={handleInputChange}
            onClick={(e) => e.stopPropagation()}
            placeholder={t("input_date_placeholder")}
            readOnly={readOnly}
            type="text"
            value={inputValue}
          />
          {!readOnly ? (
            <InputGroupAddon>
              <PopoverTrigger
                aria-label={t("input_date_toggle")}
                render={
                  <Button disabled={disabled} size="icon-xs" variant="ghost" />
                }
              >
                <CalendarIcon aria-hidden="true" />
              </PopoverTrigger>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
        <PopoverPopup align="start" alignOffset={-4} sideOffset={4}>
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
      {error ? (
        <p className="text-destructive-foreground text-xs" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
