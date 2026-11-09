import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import {
  InputFormatted,
  type InputFormattedProps,
} from "@/components/input/formatted/index.tsx";

const meta: Meta<InputFormattedProps<number>> = {
  title: "Input / Formatted",
};

export default meta;
type Story = StoryObj<typeof meta>;

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

export const Base: Story = {
  render: (args) => {
    const [val, setVal] = useState<number | undefined>(args.value);

    return (
      <div className="w-72">
        <InputFormatted
          {...pricePreset}
          {...args}
          value={val}
          onChange={(newVal) => {
            setVal(newVal);
            args.onChange?.(newVal);
          }}
        />
      </div>
    );
  },
};

export const WithInitialValue: Story = {
  args: {
    value: 1250.5,
  },
  render: (args) => {
    const [val, setVal] = useState<number>(args.value ?? 1250.5);

    return (
      <div className="w-72">
        <InputFormatted
          {...pricePreset}
          {...args}
          value={val}
          onChange={(newVal) => {
            setVal(newVal);
            args.onChange?.(newVal);
          }}
        />
      </div>
    );
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    value: 99.99,
  },
  render: (args) => (
    <div className="w-72">
      <InputFormatted {...pricePreset} {...args} />
    </div>
  ),
};

export const ReadOnly: Story = {
  args: {
    readOnly: true,
    value: 499.0,
  },
  render: (args) => (
    <div className="w-72">
      <InputFormatted {...pricePreset} {...args} />
    </div>
  ),
};

export const CustomWidthAndStyle: Story = {
  args: {
    value: 42.0,
  },
  render: (args) => {
    const [val, setVal] = useState<number | undefined>(args.value ?? 42.0);

    return (
      <InputFormatted
        {...pricePreset}
        {...args}
        className="w-96 border-primary shadow-sm"
        value={val}
        onChange={(newVal) => {
          setVal(newVal);
          args.onChange?.(newVal);
        }}
      />
    );
  },
};
