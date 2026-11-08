import { useState } from "react";
import { EyeIcon } from "lucide-react";

import { cn } from "@/lib/utils/cn.ts";
import { buttonVariants } from "@/components/ui/button.tsx";
import { ImageView } from "@/components/image/view/index.tsx";
import { useTranslation } from "@/components/context/translation.tsx";

export interface ImageThumbnailProps {
  src: string;
  alt?: string;
  /** The maximum zoom for the view. The default is 2. */
  maxZoom?: number;
  /** The file name for the download action. The default is "image". */
  downloadName?: string;
  /** The open state. The component owns the state when omitted. */
  open?: boolean;
  /** Run when the open state changes. */
  onOpenChange?: (open: boolean) => void;
  className?: string;
  /** The image class. */
  imageClassName?: string;
}

/**
 * Show an image as a button that opens the image view.
 *
 * The overlay and the eye icon show on hover, on keyboard focus, and on touch
 * devices. A click or a keyboard activation opens `ImageView`.
 *
 * The component owns the open state when `open` is omitted. Set `open` and
 * `onOpenChange` to control the state.
 */
export function ImageThumbnail({
  src,
  alt,
  maxZoom,
  downloadName,
  open,
  onOpenChange,
  className,
  imageClassName,
}: ImageThumbnailProps) {
  const { t } = useTranslation();
  const isControlled = open !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const openState = isControlled ? open : uncontrolledOpen;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  };

  return (
    <>
      <button
        aria-expanded={openState}
        aria-haspopup="dialog"
        aria-label={
          alt
            ? t("image_thumbnail_view_named", { name: alt })
            : t("image_thumbnail_view")
        }
        className={cn(
          "group relative block w-full cursor-zoom-in overflow-hidden rounded-xl",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className,
        )}
        data-slot="image-thumbnail"
        onClick={() => handleOpenChange(true)}
        type="button"
      >
        <img
          alt={alt ?? t("image_view_title")}
          className={cn("h-auto w-full object-cover", imageClassName)}
          data-slot="image-thumbnail-image"
          src={src}
        />
        <span
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none pointer-coarse:opacity-100"
          data-slot="image-thumbnail-overlay"
        >
          <span
            aria-hidden="true"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon-lg" }),
              "pointer-events-none rounded-full bg-black/32 text-white backdrop-blur-sm",
            )}
            data-slot="image-thumbnail-eye"
          >
            <EyeIcon />
          </span>
        </span>
      </button>
      <ImageView
        alt={alt}
        downloadName={downloadName}
        maxZoom={maxZoom}
        onOpenChange={handleOpenChange}
        open={openState}
        src={src}
      />
    </>
  );
}
