import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { useTranslation } from "@/components/context/translation.tsx";
import { cn } from "@/lib/utils/cn.ts";

export interface JsonViewProps {
  value: unknown;
  emptyLabel: string;
  className?: string;
}

function formatValue(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

/**
 * Shows a JSON value in a code block.
 * The copy button writes the text to the clipboard when the browser allows it.
 */
export function JsonView({
  value,
  emptyLabel,
  className,
}: JsonViewProps): React.ReactElement {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const text = useMemo(
    () => (value === undefined ? "" : formatValue(value)),
    [value],
  );

  useEffect(() => {
    return () => {
      if (timer.current !== null) clearTimeout(timer.current);
    };
  }, []);

  const handleCopy = (): void => {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setCopied(false);
      setCopyFailed(true);

      return;
    }

    void navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopyFailed(false);
        setCopied(true);
        if (timer.current !== null) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1000);
      })
      .catch(() => {
        setCopied(false);
        setCopyFailed(true);
      });
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-code text-code-foreground",
        className,
      )}
      data-slot="json-view"
    >
      {value !== undefined && (
        <div
          className="flex items-center justify-end border-b px-2 py-1.5"
          data-slot="json-view-header"
        >
          <Button
            aria-label={copied ? t("system_copied") : t("system_copy")}
            onClick={handleCopy}
            size="icon-sm"
            variant="ghost"
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </Button>
        </div>
      )}
      {value === undefined ? (
        <p className="p-3 text-muted-foreground text-sm">{emptyLabel}</p>
      ) : (
        <ScrollArea className="max-h-64">
          <pre className="whitespace-pre-wrap break-all p-3 font-mono text-xs">
            {text}
          </pre>
        </ScrollArea>
      )}
      {copyFailed && (
        <p className="border-t px-3 py-2 text-destructive-foreground text-xs">
          {t("system_copy_failed")}
        </p>
      )}
      <span aria-live="polite" className="sr-only" role="status">
        {copied ? t("system_copied") : ""}
      </span>
    </div>
  );
}
