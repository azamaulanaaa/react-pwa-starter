import type { Story, StoryDefault } from "@ladle/react";
import { useState } from "react";

import { InputFormatted, type InputFormattedProps } from "./index.tsx";

export default {
  title: "Input / Formatted",
} as StoryDefault;

const formatPrice = (val?: number) => {
  if (val === undefined || val === null || Number.isNaN(val)) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(val);
};

const parsePrice = (val: string) => {
  const cleanStr = val.replace(/[^0-9.]/g, "");
  const parsed = parseFloat(cleanStr);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const pricePreset = {
  formatter: formatPrice,
  parser: parsePrice,
  placeholder: "$0.00",
};

export const Base: Story<InputFormattedProps<number>> = (props) => {
  const [val, setVal] = useState<number | undefined>(props.value);

  return (
    <div className="w-72">
      <InputFormatted
        {...pricePreset}
        {...props}
        value={val}
        onChange={(newVal) => {
          setVal(newVal);
          props.onChange?.(newVal);
        }}
      />
    </div>
  );
};

export const WithInitialValue: Story<InputFormattedProps<number>> = (props) => {
  const [val, setVal] = useState<number>(props.value ?? 1250.5);

  return (
    <div className="w-72">
      <InputFormatted
        {...pricePreset}
        {...props}
        value={val}
        onChange={(newVal) => {
          setVal(newVal);
          props.onChange?.(newVal);
        }}
      />
    </div>
  );
};
WithInitialValue.args = {
  value: 1250.5,
};

export const Disabled: Story<InputFormattedProps<number>> = (props) => (
  <div className="w-72">
    <InputFormatted {...pricePreset} {...props} />
  </div>
);
Disabled.args = {
  disabled: true,
  value: 99.99,
};

export const ReadOnly: Story<InputFormattedProps<number>> = (props) => (
  <div className="w-72">
    <InputFormatted {...pricePreset} {...props} />
  </div>
);
ReadOnly.args = {
  readOnly: true,
  value: 499.0,
};

export const CustomWidthAndStyle: Story<InputFormattedProps<number>> = (
  props,
) => {
  const [val, setVal] = useState<number | undefined>(props.value ?? 42.0);

  return (
    <InputFormatted
      {...pricePreset}
      {...props}
      className="w-96 border-primary shadow-sm"
      value={val}
      onChange={(newVal) => {
        setVal(newVal);
        props.onChange?.(newVal);
      }}
    />
  );
};
CustomWidthAndStyle.args = {
  value: 42.0,
};
