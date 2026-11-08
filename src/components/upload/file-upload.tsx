import type { ReactNode } from "react";

import {
  AlertCircleIcon,
  FileArchiveIcon,
  FileIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  HeadphonesIcon,
  ImageIcon,
  Trash2Icon,
  UploadIcon,
  VideoIcon,
  XIcon,
} from "lucide-react";

import { useIntl } from "@/components/context/intl.tsx";
import { useTranslation } from "@/components/context/translation.tsx";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  formatBytes,
  useFileUpload,
} from "@/hooks/primitives/use-file-upload.ts";
import type {
  FileMetadata,
  FileWithPreview,
} from "@/hooks/primitives/use-file-upload.ts";
import { cn } from "@/lib/utils/cn.ts";

export interface FileUploadProps {
  initialFiles?: FileMetadata[];
  maxFiles?: number;
  maxSize?: number;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  name?: string;
  id?: string;
  className?: string;
  onFilesChange?: (files: FileWithPreview[]) => void;
  onFilesAdded?: (files: FileWithPreview[]) => void;
  /** Progress per file id. A value from 0 to 1. */
  progressByFileId?: Record<string, number>;
  /** Upload error per file id. */
  errorsByFileId?: Record<string, string>;
  /** Disable add and select while an upload runs. The remove action stays available. */
  busy?: boolean;
}

export interface FileUploadMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
}

/**
 * Return the file metadata for a form submit.
 * The value holds no File object and no preview URL.
 */
export function toFileMetadata(files: FileWithPreview[]): FileUploadMetadata[] {
  return files.map(({ id, file }) => ({
    id,
    name: file.name,
    size: file.size,
    type: file.type,
  }));
}

/**
 * Report whether every file has progress 1.
 * An empty list returns true.
 */
export function uploadsComplete(
  files: FileWithPreview[],
  progressByFileId: Record<string, number>,
): boolean {
  return files.every((file) => progressByFileId[file.id] === 1);
}

const getFileIcon = (file: File | FileMetadata) => {
  const fileName = file.name;
  const fileType = file.type;

  const iconMap = {
    archive: {
      conditions: (type: string, name: string) =>
        type.includes("zip") ||
        type.includes("archive") ||
        name.endsWith(".zip") ||
        name.endsWith(".rar"),
      icon: FileArchiveIcon,
    },
    audio: {
      conditions: (type: string) => type.includes("audio/"),
      icon: HeadphonesIcon,
    },
    excel: {
      conditions: (type: string, name: string) =>
        type.includes("excel") ||
        name.endsWith(".xls") ||
        name.endsWith(".xlsx"),
      icon: FileSpreadsheetIcon,
    },
    image: {
      conditions: (type: string) => type.startsWith("image/"),
      icon: ImageIcon,
    },
    pdf: {
      conditions: (type: string, name: string) =>
        type.includes("pdf") ||
        name.endsWith(".pdf") ||
        type.includes("word") ||
        name.endsWith(".doc") ||
        name.endsWith(".docx"),
      icon: FileTextIcon,
    },
    video: {
      conditions: (type: string) => type.includes("video/"),
      icon: VideoIcon,
    },
  };

  for (const { icon: Icon, conditions } of Object.values(iconMap)) {
    if (conditions(fileType, fileName)) {
      return <Icon className="size-4.5 opacity-80 sm:size-4" />;
    }
  }

  return <FileIcon className="size-4.5 opacity-80 sm:size-4" />;
};

const getFilePreview = (
  { file, preview }: FileWithPreview,
  overlay?: ReactNode,
) => (
  <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-t-[inherit] bg-accent">
    {file.type.startsWith("image/") && preview ? (
      <img
        alt={file.name}
        className="size-full rounded-t-[inherit] object-cover"
        src={preview}
      />
    ) : (
      getFileIcon(file)
    )}
    {overlay}
  </div>
);

/**
 * Show a drop zone, a file picker, and preview cards for a file upload.
 *
 * The component does not upload files. The app owns the upload:
 *
 * 1. Start one upload for each new file from `onFilesAdded` or `onFilesChange`.
 * 2. Set `progressByFileId[id]` from 0 to 1.
 * 3. Set `errorsByFileId[id]` when one upload fails.
 * 4. Disable the submit button while `uploadsComplete(files, progressByFileId)`
 *    is false.
 * 5. On submit, call `toFileMetadata(files)` and send only that metadata.
 *
 * The component does not call a network API, an object store, or an upload
 * library.
 */
export function FileUpload({
  initialFiles = [],
  maxFiles = 6,
  maxSize = 5 * 1024 * 1024,
  accept = "*",
  multiple = true,
  disabled = false,
  name,
  id,
  className,
  onFilesChange,
  onFilesAdded,
  progressByFileId = {},
  errorsByFileId = {},
  busy = false,
}: FileUploadProps) {
  const { t } = useTranslation();
  const { formatPercent } = useIntl();
  const actionsDisabled = disabled || busy;

  const [
    { files, isDragging, errors },
    {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      removeFile,
      clearFiles,
      getInputProps,
    },
  ] = useFileUpload({
    initialFiles,
    maxFiles,
    maxSize,
    accept,
    multiple,
    onFilesChange,
    onFilesAdded,
  });

  const maxSizeText = formatBytes(maxSize);
  const limitText =
    maxFiles === 1
      ? t("upload_limit_one", { maxSize: maxSizeText })
      : t("upload_limits", { maxFiles, maxSize: maxSizeText });

  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      data-slot="file-upload"
    >
      <div
        className="relative flex min-h-52 flex-col items-center not-data-[files]:justify-center overflow-hidden rounded-lg border border-input border-dashed p-4 transition-colors has-[input:focus]:border-ring has-[input:focus]:ring-[3px] has-[input:focus]:ring-ring/50 data-[dragging=true]:border-ring data-[dragging=true]:bg-accent/50"
        data-dragging={isDragging || undefined}
        data-files={files.length > 0 || undefined}
        data-slot="file-upload-dropzone"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          {...getInputProps({
            "aria-label": t("upload_choose_files"),
            disabled: actionsDisabled,
            id,
            name,
          })}
          className="sr-only"
        />
        {files.length > 0 ? (
          <div className="flex w-full flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="truncate font-medium text-sm">
                {t("upload_files_title", { count: files.length })}
              </h3>
              <div className="flex gap-2">
                <Button
                  disabled={actionsDisabled}
                  onClick={openFileDialog}
                  size="sm"
                  variant="outline"
                >
                  <UploadIcon aria-hidden="true" />
                  {t("upload_add_files")}
                </Button>
                <Button
                  disabled={actionsDisabled}
                  onClick={clearFiles}
                  size="sm"
                  variant="outline"
                >
                  <Trash2Icon aria-hidden="true" />
                  {t("upload_remove_all")}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {files.map((item) => {
                const progress = progressByFileId[item.id];
                const fileError = errorsByFileId[item.id];
                const clamped =
                  progress === undefined
                    ? 0
                    : Math.min(1, Math.max(0, progress));
                const showProgress = progress !== undefined && progress < 1;

                return (
                  <div
                    className={cn(
                      "relative flex flex-col rounded-lg border bg-background",
                      fileError && "border-destructive/32",
                    )}
                    data-slot="file-upload-card"
                    key={item.id}
                  >
                    {getFilePreview(
                      item,
                      showProgress ? (
                        <div
                          className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-t-[inherit] bg-background/80 p-4 backdrop-blur-xs"
                          data-slot="file-upload-progress"
                        >
                          <Progress
                            max={100}
                            value={Math.round(clamped * 100)}
                          />
                          <p className="font-medium text-sm tabular-nums">
                            {formatPercent(clamped)}
                          </p>
                        </div>
                      ) : null,
                    )}
                    <Button
                      aria-label={t("upload_remove_file", {
                        name: item.file.name,
                      })}
                      className="-end-2 -top-2 absolute z-20 rounded-full"
                      disabled={disabled}
                      onClick={() => removeFile(item.id)}
                      size="icon-xs"
                    >
                      <XIcon aria-hidden="true" />
                    </Button>
                    <div className="flex min-w-0 flex-col gap-0.5 border-t p-3">
                      <p className="truncate font-medium text-sm">
                        {item.file.name}
                      </p>
                      <p className="truncate text-muted-foreground text-xs">
                        {formatBytes(item.file.size)}
                      </p>
                      {fileError && (
                        <Alert
                          className="mt-1 rounded-lg px-2.5 py-2"
                          variant="error"
                        >
                          <AlertCircleIcon aria-hidden="true" />
                          <AlertTitle className="text-xs">
                            {t("upload_file_error_title")}
                          </AlertTitle>
                          <AlertDescription className="text-xs">
                            {fileError}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <Empty className="gap-4 p-0">
            <EmptyHeader className="gap-2">
              <EmptyMedia variant="icon">
                <UploadIcon aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>{t("upload_drop_title")}</EmptyTitle>
              <EmptyDescription>{limitText}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                disabled={actionsDisabled}
                onClick={openFileDialog}
                variant="outline"
              >
                <UploadIcon aria-hidden="true" />
                {t("upload_select_files")}
              </Button>
            </EmptyContent>
          </Empty>
        )}
      </div>
      {errors.length > 0 && (
        <Alert variant="error">
          <AlertCircleIcon aria-hidden="true" />
          <AlertTitle>{t("upload_error_title")}</AlertTitle>
          <AlertDescription>
            {errors.map((error, index) => (
              <p key={`${error}-${index}`}>{error}</p>
            ))}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
