import { useEffect, useState } from "react";
import type { Story, StoryDefault } from "@ladle/react";

import { ImageGenerator } from "@/lib/svg.ts";

import { ImagePreview, ImagePreviewProps } from "./index.tsx";

export default {
  title: "Image / Preview",
} as StoryDefault;

export const Base: Story<ImagePreviewProps> = (props) => {
  const [src, setSrc] = useState("");

  useEffect(() => {
    const blob = ImageGenerator(50, 50);
    const url = URL.createObjectURL(blob);
    setSrc(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, []);

  return <ImagePreview className="w-100 h-100" {...props} src={src} />;
};
