import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import {
  InputDate,
  type InputDateProps,
} from "@/components/input/date/index.tsx";

const meta = {
  title: "Input / Date",
  component: InputDate,
} satisfies Meta<InputDateProps>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Base: Story = {
  render: (args) => {
    const [date, setDate] = useState<Date | undefined>(args.value);

    return (
      <div className="w-72">
        <InputDate
          {...args}
          value={date}
          onChange={(newDate) => {
            setDate(newDate);
            args.onChange?.(newDate);
          }}
        />
      </div>
    );
  },
};

export const WithInitialValue: Story = {
  args: {
    value: new Date(2026, 6, 22),
  },
  render: (args) => {
    const [date, setDate] = useState<Date | undefined>(
      args.value ?? new Date(2026, 6, 22),
    );

    return (
      <div className="w-72">
        <InputDate
          {...args}
          value={date}
          onChange={(newDate) => {
            setDate(newDate);
            args.onChange?.(newDate);
          }}
        />
      </div>
    );
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    value: new Date(2026, 6, 22),
  },
  render: (args) => (
    <div className="w-72">
      <InputDate {...args} />
    </div>
  ),
};

export const ReadOnly: Story = {
  args: {
    readOnly: true,
    value: new Date(2026, 6, 22),
  },
  render: (args) => (
    <div className="w-72">
      <InputDate {...args} />
    </div>
  ),
};

export const CustomWidthAndStyle: Story = {
  render: (args) => {
    const [date, setDate] = useState<Date | undefined>(args.value);

    return (
      <InputDate
        {...args}
        className="w-96 border-primary shadow-sm"
        value={date}
        onChange={(newDate) => {
          setDate(newDate);
          args.onChange?.(newDate);
        }}
      />
    );
  },
};

export const WithLocale: Story = {
  render: (args) => {
    const [date, setDate] = useState<Date | undefined>(
      args.value ?? new Date(2026, 6, 22),
    );

    return (
      <div className="flex flex-col gap-4 w-72">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            Indonesian Locale (id) → dd-mm-yyyy
          </label>
          <InputDate
            {...args}
            locale="id"
            value={date}
            onChange={(newDate) => {
              setDate(newDate);
              args.onChange?.(newDate);
            }}
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            US Locale (en-US) → mm-dd-yyyy
          </label>
          <InputDate
            {...args}
            locale="en-US"
            value={date}
            onChange={(newDate) => {
              setDate(newDate);
              args.onChange?.(newDate);
            }}
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1">
            German Locale (de-DE) → dd-mm-yyyy
          </label>
          <InputDate
            {...args}
            locale="de-DE"
            value={date}
            onChange={(newDate) => {
              setDate(newDate);
              args.onChange?.(newDate);
            }}
          />
        </div>
      </div>
    );
  },
};
