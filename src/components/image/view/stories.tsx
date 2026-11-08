import { useState } from "react";
import type { Story, StoryDefault } from "@ladle/react";

import { ImageView } from "@/components/image/view/index.tsx";

export default {
  title: "Image / View",
} as StoryDefault;

const IMAGE_SRC = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <rect width="1200" height="800" fill="#1d4ed8"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="bold" font-size="96" fill="#ffffff">1200 x 800</text>
  </svg>
`)}`;

export const Trigger: Story = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="max-w-xl p-6">
      <button
        className="block w-full cursor-pointer overflow-hidden rounded-xl"
        onClick={() => setOpen(true)}
        type="button"
      >
        <img alt="Report" className="h-auto w-full" src={IMAGE_SRC} />
      </button>
      <ImageView
        alt="Report"
        onOpenChange={setOpen}
        open={open}
        src={IMAGE_SRC}
      />
    </div>
  );
};

export const Open: Story = () => (
  <div className="max-w-xl p-6">
    <ImageView alt="Report" onOpenChange={() => {}} open src={IMAGE_SRC} />
  </div>
);
