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

export const WithLocale: Story<InputDateProps> = (props) => {
  const [date, setDate] = useState<Date | undefined>(
    props.value ?? new Date(2026, 6, 22),
  );

  return (
    <div className="flex flex-col gap-4 w-72">
      <div>
        <label className="text-xs text-muted-foreground block mb-1">
          Indonesian Locale (id) → dd-mm-yyyy
        </label>
        <InputDate
          {...props}
          locale="id"
          value={date}
          onChange={(newDate) => {
            setDate(newDate);
            props.onChange?.(newDate);
          }}
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">
          US Locale (en-US) → mm-dd-yyyy
        </label>
        <InputDate
          {...props}
          locale="en-US"
          value={date}
          onChange={(newDate) => {
            setDate(newDate);
            props.onChange?.(newDate);
          }}
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">
          German Locale (de-DE) → dd-mm-yyyy
        </label>
        <InputDate
          {...props}
          locale="de-DE"
          value={date}
          onChange={(newDate) => {
            setDate(newDate);
            props.onChange?.(newDate);
          }}
        />
      </div>
    </div>
  );
};
