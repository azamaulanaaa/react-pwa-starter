import { type Ref, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils/cn.ts";
import { Input } from "@/components/ui/input.tsx";

function defaultFormatter<T>(value: T): string {
  return value !== undefined && value !== null ? String(value) : "";
}

function defaultParser<T>(value: string): T {
  return value as unknown as T;
}

export type InputFormattedProps<T = string> = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "defaultValue" | "onChange" | "onBlur"
> & {
  ref?: Ref<HTMLInputElement>;
  className?: string;
  placeholder?: string;
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  formatter?: (value: T) => string;
  parser?: (value: string) => T;
  disabled?: boolean;
  readOnly?: boolean;
};

export function InputFormatted<T = string>({
  ref,
  className,
  placeholder,
  value,
  defaultValue,
  onChange,
  onBlur,
  formatter = defaultFormatter,
  parser = defaultParser,
  ...props
}: InputFormattedProps<T>) {
  const isControlled = value !== undefined;

  const [uncontrolledValue, setUncontrolledValue] = useState<T | undefined>(
    defaultValue,
  );

  const activeValue = isControlled ? value : uncontrolledValue;

  const [localText, setLocalText] = useState<string>(() =>
    activeValue !== undefined && activeValue !== null
      ? formatter(activeValue)
      : "",
  );

  const previousValueRef = useRef(value);

  useEffect(() => {
    if (!isControlled) return;
    if (Object.is(previousValueRef.current, value)) return;

    previousValueRef.current = value;
    setLocalText(value !== undefined && value !== null ? formatter(value) : "");
  }, [formatter, isControlled, value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextText = e.target.value;
    const parsedValue = parser(nextText);

    setLocalText(nextText);

    if (!isControlled) {
      setUncontrolledValue(parsedValue);
    }

    onChange?.(parsedValue);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const parsedValue = parser(localText);

    if (!isControlled) {
      setUncontrolledValue(parsedValue);
    }

    onChange?.(parsedValue);
    onBlur?.(e);

    if (parsedValue !== undefined && parsedValue !== null) {
      setLocalText(formatter(parsedValue));
    } else {
      setLocalText("");
    }
  };

  return (
    <Input
      ref={ref}
      className={cn(className)}
      placeholder={placeholder}
      value={localText}
      onChange={handleChange}
      onBlur={handleBlur}
      {...props}
    />
  );
}
