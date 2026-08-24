import { useState } from "react";
import { DownloadIcon, EyeIcon } from "lucide-react";

import { cn } from "@/lib/cn.ts";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { useTranslation } from "@/components/context/translation.tsx";

export type ImagePreviewProps = {
  className?: string;
  src: string;
  alt?: string;
  fileName?: string;
};

export const ImagePreview = (
  { className, src, alt, fileName }: ImagePreviewProps,
) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const altText = alt || "Image preview";

  const handleDownload = async () => {
    try {
      // Fetch the image as a blob to force a browser download rather than opening a new tab
      const response = await fetch(src);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = fileName || src.split("/").pop()?.split("?")[0] ||
        "image";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download image:", error);
    }
  };
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        className={cn(
          "group relative cursor-pointer overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        <img
          alt={altText}
          className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          src={src}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <EyeIcon className="h-6 w-6 text-white drop-shadow-md" />
        </div>
      </DialogTrigger>

      <DialogContent
        bottomStickOnMobile={false}
        className="max-w-4xl border-none bg-transparent shadow-none sm:scale-100 overflow-visible p-0 flex flex-col items-center justify-center gap-4"
      >
        <DialogTitle className="sr-only">{altText}</DialogTitle>
        <img
          src={src}
          alt={altText}
          className="max-h-[80vh] w-auto max-w-full object-contain rounded-lg shadow-2xl"
        />

        <div className="flex items-center justify-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
          >
            <DownloadIcon className="h-4 w-4" />
            {t("image_preview_download")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
