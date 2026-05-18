import { ChangeEvent, FocusEvent } from "react";

import { cn } from "@/lib/cn.ts";

export type TextInputProps = {
  name?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  width?: string;
  disabled?: boolean;
};

export function TextInput(props: TextInputProps) {
  const handleOnChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (props.onChange) {
      props.onChange(e.target.value);
    }
  };

  const handleOnBlur = (_e: FocusEvent<HTMLInputElement>) => {
    if (props.onBlur) {
      props.onBlur();
    }
  };

  return (
    <input
      type="text"
      className={cn(
        "border p-1 w-full",
        "focus:outline-none",
        "border-neutral-300 text-neutral-800 bg-neutral-50",
        "dark:border-neutral-700 dark:text-neutral-200 dark:bg-neutral-900",
        {
          "bg-neutral-200 dark:bg-neutral-800": props.disabled,
        },
      )}
      name={props.name}
      placeholder={props.placeholder}
      value={props.value}
      onChange={handleOnChange}
      onBlur={handleOnBlur}
      disabled={props.disabled}
    />
  );
}
