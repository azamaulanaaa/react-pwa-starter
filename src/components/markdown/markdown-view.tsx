import { type MouseEvent, type ReactNode, useMemo } from "react";
import Markdown, { type Components } from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { useTranslation } from "@/components/context/translation.tsx";
import {
  type FileBlobResolver,
  useFileBlob,
} from "@/hooks/engines/use-file-blob.ts";
import { cn } from "@/lib/utils/cn.ts";

/** Defines the identifier format for a mention, a page, or a file. */
const ID_PATTERN = "[A-Za-z0-9_-]+";

/** Matches a mention path and captures the identifier. */
const MENTION_PATH = new RegExp(`^/users/(${ID_PATTERN})$`);

/** Matches a page path and captures the identifier. */
const PAGE_PATH = new RegExp(`^/pages/(${ID_PATTERN})$`);

/** Matches a file path and captures the identifier. */
const FILE_PATH = new RegExp(`^/fs/(${ID_PATTERN})$`);

/** Lists the URL schemes that the view rejects. */
const FORBIDDEN_SCHEMES = new Set([
  "blob",
  "data",
  "file",
  "javascript",
  "vbscript",
]);

/**
 * Defines the sanitize schema for the rendered HTML.
 * The schema accepts https: and mailto: links only.
 * The schema accepts no absolute image protocol.
 */
const SANITIZE_SCHEMA = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    href: ["https", "mailto"],
    src: [],
  },
};

/** Defines one chip that the view renders for a link. */
type Chip = {
  kind: "mention" | "page";
  id: string;
};

/** Defines the props of the Markdown view. */
export interface MarkdownViewProps {
  /** The canonical md-lite/1 Markdown text. */
  markdown: string;
  /** The extra class names for the outer element. */
  className?: string;
  /** The optional handler for a link click. The view stops the default navigation. */
  onLinkClick?: (href: string) => void;
  /**
   * Loads one image file for a file id.
   * A resolver takes priority over the worker file store.
   */
  resolveImageFile?: FileBlobResolver;
}

/** Returns the origin that relative URLs resolve against. */
function getOrigin(): string {
  return typeof location === "undefined" ? "http://localhost" : location.origin;
}

/**
 * Checks one URL against the allowed forms.
 * The function accepts https:, mailto:, and same-origin relative paths.
 * The function rejects javascript:, data:, vbscript:, file:, blob:, and //host.
 */
function isSafeHref(value: string): boolean {
  const compact = value.replace(/\s/g, "");

  if (compact === "") return false;

  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(compact);
  if (scheme !== null) {
    const name = scheme[1].toLowerCase();

    if (FORBIDDEN_SCHEMES.has(name)) return false;
    if (name === "mailto") return compact.length > "mailto:".length;

    if (name === "https") {
      try {
        return new URL(compact).hostname !== "";
      } catch {
        return false;
      }
    }

    return false;
  }

  if (/^[\\/]{2}/.test(compact)) return false;

  try {
    return new URL(compact, getOrigin()).origin === getOrigin();
  } catch {
    return false;
  }
}

/** Returns a safe URL for react-markdown, or an empty string. */
function transformUrl(url: string): string {
  return isSafeHref(url) ? url : "";
}

/** Reads the chip from a link URL. The function returns null for a normal link. */
function readChip(href: string): Chip | null {
  let pathname: string;

  try {
    pathname = new URL(href, getOrigin()).pathname;
  } catch {
    return null;
  }

  const mention = MENTION_PATH.exec(pathname);
  if (mention !== null) {
    return { kind: "mention", id: mention[1] };
  }

  const page = PAGE_PATH.exec(pathname);
  if (page !== null) {
    return { kind: "page", id: page[1] };
  }

  return null;
}

/** Reads the file id from an image source. The function returns null for other sources. */
function readFileId(src: string | undefined): string | null {
  if (src === undefined) return null;

  const match = FILE_PATH.exec(src);
  return match === null ? null : match[1];
}

/** Shows the alt text and the unavailable state for an image. */
function ImageUnavailable({ alt }: { alt?: string }): ReactNode {
  const { t } = useTranslation();

  return (
    <span className="md-image-fallback" data-state="unavailable">
      {alt ? <span className="md-image-alt">{alt}</span> : null}
      <span className="md-image-message">{t("markdown_file_unavailable")}</span>
    </span>
  );
}

/** Loads one worker image and shows the result. */
function WorkerImage({
  alt,
  fileId,
  resolveFile,
  title,
}: {
  alt?: string;
  fileId: string;
  resolveFile?: FileBlobResolver;
  title?: string;
}): ReactNode {
  const state = useFileBlob(fileId, resolveFile);

  if (state.status === "ready") {
    return (
      <img
        alt={alt ?? ""}
        className="md-image"
        decoding="async"
        loading="lazy"
        src={state.url}
        title={title}
      />
    );
  }

  if (state.status === "loading") {
    return (
      <span aria-busy="true" className="md-image-fallback" data-state="loading">
        {alt ? <span className="md-image-alt">{alt}</span> : null}
      </span>
    );
  }

  return <ImageUnavailable alt={alt} />;
}

/** Shows one Markdown image. The view loads /fs/ images from the worker store. */
function MarkdownImage({
  alt,
  resolveFile,
  src,
  title,
}: {
  alt?: string;
  resolveFile?: FileBlobResolver;
  src?: string;
  title?: string;
}): ReactNode {
  const fileId = readFileId(src);

  if (fileId === null) {
    return <ImageUnavailable alt={alt} />;
  }

  return (
    <WorkerImage
      alt={alt}
      fileId={fileId}
      resolveFile={resolveFile}
      title={title}
    />
  );
}

/** Renders the Markdown text as sanitized HTML. */
export function MarkdownView({
  className,
  markdown,
  onLinkClick,
  resolveImageFile,
}: MarkdownViewProps): ReactNode {
  const { t } = useTranslation();

  const components = useMemo<Components>(() => {
    const linkClick =
      onLinkClick === undefined
        ? undefined
        : (href: string) => (event: MouseEvent<HTMLAnchorElement>) => {
            event.preventDefault();
            onLinkClick(href);
          };

    return {
      a: ({ children, href, title }) => {
        if (href === undefined || !isSafeHref(href)) {
          return <span className="md-link-blocked">{children}</span>;
        }

        const onClick = linkClick?.(href);
        const chip = readChip(href);

        if (chip === null) {
          return (
            <a className="md-link" href={href} onClick={onClick} title={title}>
              {children}
            </a>
          );
        }

        if (chip.kind === "mention") {
          return (
            <a
              className="md-chip md-chip-mention"
              data-chip="mention"
              data-mention-id={chip.id}
              href={href}
              onClick={onClick}
              title={title}
            >
              {children}
            </a>
          );
        }

        return (
          <a
            className="md-chip md-chip-page"
            data-chip="page"
            data-page-id={chip.id}
            href={href}
            onClick={onClick}
            title={title}
          >
            {children}
          </a>
        );
      },
      img: ({ alt, src, title }) => (
        <MarkdownImage
          alt={alt}
          resolveFile={resolveImageFile}
          src={src}
          title={title}
        />
      ),
      pre: ({ children }) => (
        <div
          aria-label={t("markdown_code_region")}
          className="md-code-block"
          role="region"
          tabIndex={0}
        >
          <pre>{children}</pre>
        </div>
      ),
      table: ({ children }) => (
        <div
          aria-label={t("markdown_table_region")}
          className="md-table-wrap"
          role="region"
          tabIndex={0}
        >
          <table>{children}</table>
        </div>
      ),
    };
  }, [onLinkClick, resolveImageFile, t]);

  return (
    <div className={cn("markdown-body", className)} data-slot="markdown-view">
      {markdown.trim() === "" ? (
        <p className="markdown-empty">{t("markdown_empty")}</p>
      ) : (
        <Markdown
          components={components}
          rehypePlugins={[[rehypeSanitize, SANITIZE_SCHEMA]]}
          remarkPlugins={[remarkGfm]}
          remarkRehypeOptions={{ allowDangerousHtml: false }}
          skipHtml
          urlTransform={transformUrl}
        >
          {markdown}
        </Markdown>
      )}
    </div>
  );
}
