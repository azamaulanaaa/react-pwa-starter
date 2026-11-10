import { useEffect, useState } from "react";
import {
  DownloadIcon,
  MinusIcon,
  PlusIcon,
  RotateCcwIcon,
  XIcon,
} from "lucide-react";

import { cn } from "@/lib/utils/cn.ts";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogBackdrop,
  DialogPortal,
  DialogPrimitive,
} from "@/components/ui/dialog.tsx";
import {
  Group,
  GroupSeparator,
  GroupText,
} from "@/components/ui/group.tsx";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <DialogPortal>
          <DialogBackdrop data-slot="image-view-backdrop" />
          <DialogPrimitive.Popup
            className={cn(
              "fixed inset-0 z-50 flex items-center justify-center bg-transparent outline-none",
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

            <div
              className="size-full overflow-auto p-4"
              data-slot="image-view-viewport"
            >
              <div className="flex min-h-full min-w-full items-center justify-center">
                <img
                  alt={alt ?? t("image_view_title")}
                  className="h-auto max-h-[80vh] w-auto max-w-[80vw] object-contain transition-transform duration-200 ease-out motion-reduce:transition-none"
                  data-slot="image-view-image"
                  src={src}
                  style={{
                    transform: `scale(${currentZoom})`,
                    transformOrigin: "center",
                  }}
                />
              </div>
            </div>

            <DialogPrimitive.Close
              aria-label={t("image_view_close")}
              className="fixed end-4 top-4 z-20 rounded-full bg-black/32 backdrop-blur-sm"
              data-slot="image-view-close"
              render={<Button size="icon" variant="ghost" />}
            >
              <XIcon />
            </DialogPrimitive.Close>

            <Button
              className="fixed inset-x-0 bottom-6 z-20 mx-auto w-fit"
              data-slot="image-view-download"
              render={<a download={downloadName ?? "image"} href={src} />}
              variant="outline"
            >
              <DownloadIcon />
              {t("image_view_download")}
            </Button>

            <Group
              aria-label={t("image_view_zoom_controls")}
              className="fixed start-4 top-4 z-20"
              data-slot="image-view-zoom-controls"
            >
              <Button
                aria-label={t("image_view_zoom_out")}
                disabled={currentZoom <= 1}
                onClick={zoomOut}
                size="icon-sm"
                variant="outline"
              >
                <MinusIcon />
              </Button>

              <GroupSeparator />

              <GroupText
                className="min-w-12 justify-center bg-popover text-foreground tabular-nums dark:bg-input/32"
                render={
                  <span
                    aria-label={t("image_view_zoom_level", {
                      percent: formatPercent(currentZoom),
                    })}
                    aria-live="polite"
                    role="status"
                  />
                }
              >
                {formatPercent(currentZoom)}
              </GroupText>

              <GroupSeparator />

              <Button
                aria-label={t("image_view_zoom_in")}
                disabled={currentZoom >= zoomLimit}
                onClick={zoomIn}
                size="icon-sm"
                variant="outline"
              >
                <PlusIcon />
              </Button>

              <GroupSeparator />

              <Button
                aria-label={t("image_view_zoom_reset")}
                disabled={currentZoom <= 1}
                onClick={zoomReset}
                size="icon-sm"
                variant="outline"
              >
                <RotateCcwIcon />
              </Button>
            </Group>
          </DialogPrimitive.Popup>
        </DialogPortal>
      ) : null}
    </Dialog>
  );
}
