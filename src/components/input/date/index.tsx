import { type ChangeEvent, type FocusEvent, useEffect, useState } from "react";
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

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(dateStr: string): Date | undefined {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);

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

export type InputDateProps = {
  name?: string;
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  onBlur?: () => void;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
};

export function InputDate({
  name,
  value,
  onChange,
  onBlur,
  className,
  disabled = false,
  readOnly = false,
}: InputDateProps) {
  const [inputValue, setInputValue] = useState<string>(
    value ? formatDate(value) : "",
  );
  const [month, setMonth] = useState<Date>(value || new Date());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setInputValue(value ? formatDate(value) : "");
    if (value) setMonth(value);
  }, [value]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    const parsedDate = parseDate(val);
    if (parsedDate) {
      setMonth(parsedDate);
      onChange?.(parsedDate);
    }
  };

  const handleSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      onChange?.(selectedDate);
      setInputValue(formatDate(selectedDate));
      setMonth(selectedDate);
    } else {
      setInputValue("");
      onChange?.(undefined);
    }
  };

  const handleInputBlur = (_e: FocusEvent<HTMLInputElement>) => {
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
          type="date"
          className="*:[input]:[&::-webkit-calendar-picker-indicator]:hidden *:[input]:[&::-webkit-calendar-picker-indicator]:appearance-none"
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
          month={month}
          onMonthChange={setMonth}
          onSelect={handleSelect}
          selected={value}
        />
      </PopoverPopup>
    </Popover>
  );
}
