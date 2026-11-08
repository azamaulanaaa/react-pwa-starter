import { useEffect, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  DownloadIcon,
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";

import { cn } from "@/lib/utils/cn.ts";
import { Button } from "@/components/ui/button.tsx";
import { useIntl } from "@/components/context/intl.tsx";
import { useTranslation } from "@/components/context/translation.tsx";

const ZOOM_STEP = 0.25;

export interface ImageViewProps {
  src: string;
  alt?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The maximum zoom. The default is 2. */
  maxZoom?: number;
  /** The file name for the download action. The default is "image". */
  downloadName?: string;
  className?: string;
}

export function ImageView({
  src,
  alt,
  open,
  onOpenChange,
  maxZoom = 2,
  downloadName,
  className,
}: ImageViewProps) {
  const { t } = useTranslation();
  const { formatPercent } = useIntl();
  const [zoom, setZoom] = useState(1);
  const zoomLimit = Math.max(1, maxZoom);
  const currentZoom = Math.min(Math.max(zoom, 1), zoomLimit);

  useEffect(() => {
    setZoom(1);
  }, [open, src]);

  useEffect(() => {
    setZoom((value) => Math.min(Math.max(value, 1), zoomLimit));
  }, [zoomLimit]);

  const zoomIn = () => {
    setZoom((value) => Math.min(zoomLimit, value + ZOOM_STEP));
  };

  const zoomOut = () => {
    setZoom((value) => Math.max(1, value - ZOOM_STEP));
  };

  const zoomReset = () => {
    setZoom(1);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md"
            data-slot="image-view-backdrop"
          />
          <DialogPrimitive.Popup
            className={cn(
              "fixed inset-0 z-50 flex items-center justify-center bg-transparent p-4 outline-none",
              className,
            )}
            data-slot="image-view"
          >
            <DialogPrimitive.Title className="sr-only">
              {t("image_view_title")}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              {t("image_view_description")}
            </DialogPrimitive.Description>

            <img
              alt={alt ?? t("image_view_title")}
              className="h-auto max-h-[80vh] w-auto max-w-[80vw] object-contain transition-transform duration-200 ease-out"
              data-slot="image-view-image"
              src={src}
              style={{
                transform: `scale(${currentZoom})`,
                transformOrigin: "center",
              }}
            />

            <DialogPrimitive.Close
              aria-label={t("image_view_close")}
              className="fixed end-4 top-4 z-20"
              data-slot="image-view-close"
              render={<Button size="icon-lg" variant="default" />}
            >
              <XIcon />
            </DialogPrimitive.Close>

            <Button
              className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2"
              data-slot="image-view-download"
              render={<a download={downloadName ?? "image"} href={src} />}
              variant="outline"
            >
              <DownloadIcon />
              {t("image_view_download")}
            </Button>

            <div
              className="fixed start-4 top-4 z-20 flex items-center gap-1 rounded-full border-0 bg-background/80 p-1 shadow-none backdrop-blur"
              data-slot="image-view-zoom-controls"
            >
              <Button
                aria-label={t("image_view_zoom_out")}
                disabled={currentZoom <= 1}
                onClick={zoomOut}
                size="icon-sm"
                variant="ghost"
              >
                <MinusIcon />
              </Button>

              <span
                aria-label={t("image_view_zoom_level", {
                  percent: formatPercent(currentZoom),
                })}
                className="min-w-12 text-center text-sm tabular-nums"
              >
                {formatPercent(currentZoom)}
              </span>

              <Button
                aria-label={t("image_view_zoom_in")}
                disabled={currentZoom >= zoomLimit}
                onClick={zoomIn}
                size="icon-sm"
                variant="ghost"
              >
                <PlusIcon />
              </Button>

              <Button
                aria-label={t("image_view_zoom_reset")}
                disabled={currentZoom <= 1}
                onClick={zoomReset}
                size="icon-sm"
                variant="ghost"
              >
                <RotateCcwIcon />
              </Button>
            </div>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      ) : null}
    </DialogPrimitive.Root>
  );
}
