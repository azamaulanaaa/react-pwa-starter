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
 * Shows a JSON value in a bordered block.
 * The copy button writes the text to the clipboard when the browser allows it.
 */
export function JsonView({
  value,
  emptyLabel,
  className,
}: JsonViewProps): React.ReactElement {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
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
    if (!navigator.clipboard?.writeText) return;

    void navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        if (timer.current !== null) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1000);
      })
      .catch(() => {});
  };

  return (
    <div
      className={cn(
        "relative rounded-lg border bg-muted/32 text-foreground",
        className,
      )}
      data-slot="json-view"
    >
      {value !== undefined && (
        <div className="absolute end-2 top-2 z-10">
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
          <pre className="whitespace-pre-wrap break-all p-3 pe-12 pt-11 font-mono text-xs">
            {text}
          </pre>
        </ScrollArea>
      )}
    </div>
  );
}
