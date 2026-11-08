import { useState } from "react";
import type { Story, StoryDefault } from "@ladle/react";

import { ImageThumbnail } from "@/components/image/thumbnail/index.tsx";

export default {
  title: "Image / Thumbnail",
} as StoryDefault;

const IMAGE_SRC = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    <rect width="1200" height="800" fill="#1d4ed8"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="bold" font-size="96" fill="#ffffff">1200 x 800</text>
  </svg>
`)}`;

const GALLERY_SOURCES = [
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
      <rect width="1200" height="800" fill="#0f766e"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="bold" font-size="96" fill="#ffffff">1200 x 800</text>
    </svg>
  `)}`,
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
      <rect width="800" height="800" fill="#b45309"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="bold" font-size="80" fill="#ffffff">800 x 800</text>
    </svg>
  `)}`,
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="800" height="1200" viewBox="0 0 800 1200">
      <rect width="800" height="1200" fill="#7e22ce"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="bold" font-size="72" fill="#ffffff">800 x 1200</text>
    </svg>
  `)}`,
];

export const Default: Story = () => (
  <div className="p-6">
    <ImageThumbnail alt="Report" className="max-w-xl" src={IMAGE_SRC} />
  </div>
);

export const Controlled: Story = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex max-w-xl flex-col gap-4 p-6">
      <ImageThumbnail
        alt="Report"
        onOpenChange={setOpen}
        open={open}
        src={IMAGE_SRC}
      />
      <p className="text-muted-foreground text-sm">
        The lightbox is {open ? "open" : "closed"}.
      </p>
    </div>
  );
};

export const Gallery: Story = () => (
  <div className="grid max-w-3xl grid-cols-2 gap-4 p-6">
    <ImageThumbnail alt="Teal report" src={GALLERY_SOURCES[0]} />
    <ImageThumbnail alt="Amber report" src={GALLERY_SOURCES[1]} />
    <ImageThumbnail
      alt="Purple report"
      className="col-span-2 max-w-sm"
      src={GALLERY_SOURCES[2]}
    />
  </div>
);
