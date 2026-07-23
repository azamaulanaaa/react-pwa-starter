import type { Story, StoryDefault } from "@ladle/react";
import { useState } from "react";

import { InputDate, type InputDateProps } from "./index.tsx";

export default {
  title: "Input / Date",
} as StoryDefault;

export const Base: Story<InputDateProps> = (props) => {
  const [date, setDate] = useState<Date | undefined>(props.value);

  return (
    <div className="w-72">
      <InputDate
        {...props}
        value={date}
        onChange={(newDate) => {
          setDate(newDate);
          props.onChange?.(newDate);
        }}
      />
    </div>
  );
};

export const WithInitialValue: Story<InputDateProps> = (props) => {
  const [date, setDate] = useState<Date | undefined>(
    props.value ?? new Date(2026, 6, 22),
  );

  return (
    <div className="w-72">
      <InputDate
        {...props}
        value={date}
        onChange={(newDate) => {
          setDate(newDate);
          props.onChange?.(newDate);
        }}
      />
    </div>
  );
};
WithInitialValue.args = {
  value: new Date(2026, 6, 22),
};

export const Disabled: Story<InputDateProps> = (props) => (
  <div className="w-72">
    <InputDate {...props} />
  </div>
);
Disabled.args = {
  disabled: true,
  value: new Date(2026, 6, 22),
};

export const ReadOnly: Story<InputDateProps> = (props) => (
  <div className="w-72">
    <InputDate {...props} />
  </div>
);
ReadOnly.args = {
  readOnly: true,
  value: new Date(2026, 6, 22),
};

export const CustomWidthAndStyle: Story<InputDateProps> = (props) => {
  const [date, setDate] = useState<Date | undefined>(props.value);

  return (
    <InputDate
      {...props}
      className="w-96 border-primary shadow-sm"
      value={date}
      onChange={(newDate) => {
        setDate(newDate);
        props.onChange?.(newDate);
      }}
    />
  );
};
