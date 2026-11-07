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

import { useTranslation } from "@/components/context/translation.tsx";
import { Button } from "@/components/ui/button.tsx";
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
      return <Icon className="size-5 opacity-60" />;
    }
  }

  return <FileIcon className="size-5 opacity-60" />;
};

const getFilePreview = ({ file, preview }: FileWithPreview) => (
  <div className="flex aspect-square items-center justify-center overflow-hidden rounded-t-[inherit] bg-accent">
    {file.type.startsWith("image/") && preview ? (
      <img
        alt={file.name}
        className="size-full rounded-t-[inherit] object-cover"
        src={preview}
      />
    ) : (
      getFileIcon(file)
    )}
  </div>
);

/**
 * Show a drop zone, a file picker, and preview cards for a file upload.
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
}: FileUploadProps) {
  const { t } = useTranslation();

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
        className="relative flex min-h-52 flex-col items-center not-data-[files]:justify-center overflow-hidden rounded-xl border border-input border-dashed p-4 transition-colors has-[input:focus]:border-ring has-[input:focus]:ring-[3px] has-[input:focus]:ring-ring/50 data-[dragging=true]:bg-accent/50"
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
            disabled,
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
                  disabled={disabled}
                  onClick={openFileDialog}
                  size="sm"
                  variant="outline"
                >
                  <UploadIcon
                    aria-hidden="true"
                    className="-ms-0.5 size-3.5 opacity-60"
                  />
                  {t("upload_add_files")}
                </Button>
                <Button
                  disabled={disabled}
                  onClick={clearFiles}
                  size="sm"
                  variant="outline"
                >
                  <Trash2Icon
                    aria-hidden="true"
                    className="-ms-0.5 size-3.5 opacity-60"
                  />
                  {t("upload_remove_all")}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {files.map((item) => (
                <div
                  className="relative flex flex-col rounded-md border bg-background"
                  data-slot="file-upload-card"
                  key={item.id}
                >
                  {getFilePreview(item)}
                  <Button
                    aria-label={t("upload_remove_file", {
                      name: item.file.name,
                    })}
                    className="-top-2 -right-2 absolute size-6 rounded-full border-2 border-background shadow-none focus-visible:border-background"
                    disabled={disabled}
                    onClick={() => removeFile(item.id)}
                    size="icon"
                  >
                    <XIcon className="size-3.5" />
                  </Button>
                  <div className="flex min-w-0 flex-col gap-0.5 border-t p-3">
                    <p className="truncate font-medium text-[13px]">
                      {item.file.name}
                    </p>
                    <p className="truncate text-muted-foreground text-xs">
                      {formatBytes(item.file.size)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center px-4 py-3 text-center">
            <div
              aria-hidden="true"
              className="mb-2 flex size-11 shrink-0 items-center justify-center rounded-full border bg-background"
            >
              <UploadIcon className="size-4 opacity-60" />
            </div>
            <p className="mb-1.5 font-medium text-sm">
              {t("upload_drop_title")}
            </p>
            <p className="text-muted-foreground text-xs">{limitText}</p>
            <Button
              className="mt-4"
              disabled={disabled}
              onClick={openFileDialog}
              variant="outline"
            >
              <UploadIcon aria-hidden="true" className="-ms-1 opacity-60" />
              {t("upload_select_files")}
            </Button>
          </div>
        )}
      </div>
      {errors.length > 0 && (
        <div
          className="flex items-center gap-1 text-destructive-foreground text-xs"
          role="alert"
        >
          <AlertCircleIcon className="size-3 shrink-0" />
          <span>{errors[0]}</span>
        </div>
      )}
    </div>
  );
}
