import { type Ref, useEffect, useState } from "react";

import { cn } from "@/lib/cn.ts";
import { Input } from "@/components/ui/input.tsx";

export type InputFormattedProps<T = string> =
  & Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "value" | "defaultValue" | "onChange" | "onBlur"
  >
  & {
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
  formatter = (val) => (val !== undefined && val !== null ? String(val) : ""),
  parser = (val) => val as unknown as T,
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
      : ""
  );

  useEffect(() => {
    setLocalText(
      activeValue !== undefined && activeValue !== null
        ? formatter(activeValue)
        : "",
    );
  }, [activeValue, formatter]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalText(e.target.value);
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
