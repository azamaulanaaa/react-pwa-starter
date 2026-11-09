import type {
  Definition,
  Image,
  ImageReference,
  Link,
  LinkReference,
  Nodes,
  Root,
  Table,
} from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { SKIP, visit } from "unist-util-visit";

/** Defines the size limit for one Markdown document in bytes. */
export const MARKDOWN_MAX_BYTES = 100 * 1024;

/** Defines the greatest list nesting depth. */
export const MARKDOWN_MAX_LIST_DEPTH = 3;

/** Defines the greatest table width in columns. */
export const MARKDOWN_MAX_TABLE_COLUMNS = 20;

/** Defines the greatest table length in body rows. */
export const MARKDOWN_MAX_TABLE_ROWS = 500;

/** Defines the identifier format for a mention, a page, or a file. */
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Matches a line break element that the dialect accepts. */
const BR_PATTERN = /^<br\s*\/?>$/i;

/** Matches the start of an MDX import or export statement. */
const MDX_MODULE_PATTERN =
  /^\s*(?:import\s+[^\n]*\bfrom\s+["']|export\s+(?:default|const|let|var|function|class)\b)/m;

/** Matches a block math expression. */
const BLOCK_MATH_PATTERN = /(?:^|\n)[ \t]*\$\$[\s\S]*?\$\$/;

/** Matches an inline math expression. */
const INLINE_MATH_PATTERN =
  /(?:^|[^\\$])\$(?![\s$])(?:\\.|[^$\\\n])+?(?<![\s\\])\$/;

/** Lists the AST nodes that are outside the md-lite/1 dialect. */
const UNSUPPORTED_NODE_TYPES = new Set([
  "containerDirective",
  "leafDirective",
  "math",
  "inlineMath",
  "mdxFlowExpression",
  "mdxJsxFlowElement",
  "mdxJsxTextElement",
  "mdxTextExpression",
  "mdxjsEsm",
  "textDirective",
  "toml",
  "yaml",
]);

/** Defines the fixed options that the canonical stringifier uses. */
export const CANONICAL_STRINGIFY_OPTIONS = {
  bullet: "-",
  emphasis: "*",
  strong: "*",
  fence: "`",
  fences: true,
  listItemIndent: "one",
  rule: "-",
  ruleRepetition: 3,
  setext: false,
  closeAtx: false,
  incrementListMarker: true,
  resourceLink: true,
  tightDefinitions: true,
  quote: '"',
  tablePipeAlign: false,
  tableCellPadding: true,
} as const;

/** Lists the error codes that validation can return. */
export type MarkdownErrorCode =
  | "unsupported_html"
  | "unsupported_footnote"
  | "unsupported_syntax"
  | "link_not_allowed"
  | "image_not_allowed"
  | "too_large"
  | "too_deep"
  | "too_wide"
  | "too_long";

/** Defines the result of one validation. */
export type MarkdownValidation =
  | { ok: true; canonical: string; hash: string }
  | { ok: false; code: MarkdownErrorCode; message: string };

/** Defines the error message for each error code. */
const ERROR_MESSAGES: Record<MarkdownErrorCode, string> = {
  unsupported_html: "Remove the HTML. The document accepts Markdown only.",
  unsupported_footnote:
    "Remove the footnote. The document does not support footnotes.",
  unsupported_syntax:
    "Remove this syntax. The document uses the md-lite/1 dialect.",
  link_not_allowed:
    "Use an https: link, a mailto: link, or a path that starts with /. Remove the other link.",
  image_not_allowed:
    "Use an image path that starts with /fs/. Remove the other image.",
  too_large: "Shorten the document to 100 KB or less.",
  too_deep: "Reduce the list depth to 3 or less.",
  too_wide: "Reduce the table width to 20 columns or less.",
  too_long: "Reduce the table length to 500 rows or less.",
};

const parser = unified().use(remarkParse).use(remarkGfm);
const serializer = unified()
  .use(remarkStringify, CANONICAL_STRINGIFY_OPTIONS)
  .use(remarkGfm);

/**
 * Parses Markdown into an mdast tree.
 * The function removes a byte order mark and converts CRLF to LF.
 */
export function parse(markdown: string): Root {
  const input = markdown.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");

  return parser.parse(input) as Root;
}

/**
 * Serializes an mdast tree with the canonical stringify options.
 */
export function stringify(tree: Root): string {
  return serializer.stringify(tree);
}

/**
 * Normalizes an mdast tree for the md-lite/1 dialect.
 * The function resolves reference links, removes definitions, and converts
 * a line break element to a hard break.
 * The function sets `spread` to false on every list and list item.
 * md-lite/1 uses tight lists. The editor has no node for a loose list.
 */
export function normalize(tree: Root): Root {
  const normalized = structuredClone(tree);
  const definitions = new Map<string, Definition>();

  visit(normalized, "definition", (node) => {
    definitions.set(node.identifier, node);
  });

  visit(normalized, (node, index, parent) => {
    if (node.type === "list" || node.type === "listItem") {
      node.spread = false;
    }

    if (!parent || index === undefined) {
      return;
    }

    if (node.type === "html" && BR_PATTERN.test(node.value)) {
      const next = parent.children[index + 1];
      if (next?.type === "text" && next.value.startsWith("\n")) {
        next.value = next.value.slice(1);
      }

      const previous = parent.children[index - 1];
      if (previous?.type === "text" && previous.value.endsWith("\n")) {
        previous.value = previous.value.slice(0, -1);
      }

      parent.children[index] = { type: "break" };
      return SKIP;
    }

    if (node.type === "linkReference") {
      const definition = definitions.get(node.identifier);
      if (!definition) {
        return;
      }

      const link: Link = {
        type: "link",
        url: definition.url,
        title: definition.title ?? null,
        children: (node as LinkReference).children,
      };

      parent.children[index] = link;
      return SKIP;
    }

    if (node.type === "imageReference") {
      const definition = definitions.get(node.identifier);
      if (!definition) {
        return;
      }

      const image: Image = {
        type: "image",
        url: definition.url,
        title: definition.title ?? null,
        alt: (node as ImageReference).alt ?? "",
      };

      parent.children[index] = image;
      return SKIP;
    }

    return;
  });

  visit(normalized, "definition", (_node, index, parent) => {
    if (!parent || index === undefined) {
      return;
    }

    parent.children.splice(index, 1);
    return [SKIP, index];
  });

  return normalized;
}

/**
 * Returns the canonical Markdown string for one document.
 */
export function canonicalize(markdown: string): string {
  return stringify(normalize(parse(markdown)));
}

/**
 * Returns the SHA-256 hash of the canonical Markdown string.
 * The hash is lowercase hexadecimal.
 */
export async function hashCanonical(markdown: string): Promise<string> {
  const canonical = canonicalize(markdown);
  const bytes = new TextEncoder().encode(canonical);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);

  return toHex(new Uint8Array(digest));
}

/**
 * Validates one Markdown document against the md-lite/1 dialect.
 * A valid document returns the canonical string and its hash.
 */
export function validate(markdown: string): MarkdownValidation {
  if (new TextEncoder().encode(markdown).byteLength > MARKDOWN_MAX_BYTES) {
    return failure("too_large");
  }

  const tree = parse(markdown);

  const treeError = findTreeError(tree);
  if (treeError) {
    return failure(treeError);
  }

  const normalized = normalize(tree);
  const limitError = findLimitError(normalized);
  if (limitError) {
    return failure(limitError);
  }

  const linkError = findLinkError(normalized);
  if (linkError) {
    return failure(linkError);
  }

  const canonical = stringify(normalized);

  return { ok: true, canonical, hash: sha256Hex(canonical) };
}

function findTreeError(tree: Root): MarkdownErrorCode | undefined {
  let code: MarkdownErrorCode | undefined;

  visit(tree, (node) => {
    if (code) {
      return SKIP;
    }

    if (node.type === "html") {
      if (BR_PATTERN.test(node.value)) {
        return;
      }

      const tag = /^<\/?([A-Za-z][\w.:-]*)/.exec(node.value);
      code =
        tag && /^[A-Z]/.test(tag[1])
          ? "unsupported_syntax"
          : "unsupported_html";
      return SKIP;
    }

    if (
      node.type === "footnoteReference" ||
      node.type === "footnoteDefinition"
    ) {
      code = "unsupported_footnote";
      return SKIP;
    }

    if (UNSUPPORTED_NODE_TYPES.has(node.type)) {
      code = "unsupported_syntax";
      return SKIP;
    }

    if (
      node.type === "text" &&
      (BLOCK_MATH_PATTERN.test(node.value) ||
        INLINE_MATH_PATTERN.test(node.value) ||
        MDX_MODULE_PATTERN.test(node.value))
    ) {
      code = "unsupported_syntax";
      return SKIP;
    }

    return;
  });

  return code;
}

function findLimitError(tree: Root): MarkdownErrorCode | undefined {
  if (listDepth(tree) > MARKDOWN_MAX_LIST_DEPTH) {
    return "too_deep";
  }

  let code: MarkdownErrorCode | undefined;

  visit(tree, "table", (table: Table) => {
    if (code) {
      return SKIP;
    }

    const columns = table.children.reduce(
      (maximum, row) => Math.max(maximum, row.children.length),
      0,
    );

    if (columns > MARKDOWN_MAX_TABLE_COLUMNS) {
      code = "too_wide";
      return SKIP;
    }

    const rows = Math.max(0, table.children.length - 1);
    if (rows > MARKDOWN_MAX_TABLE_ROWS) {
      code = "too_long";
      return SKIP;
    }

    return;
  });

  return code;
}

function findLinkError(tree: Root): MarkdownErrorCode | undefined {
  let code: MarkdownErrorCode | undefined;

  visit(tree, (node) => {
    if (code) {
      return SKIP;
    }

    if (node.type === "link" && !isAllowedLink(node.url)) {
      code = "link_not_allowed";
      return SKIP;
    }

    if (node.type === "image" && !isAllowedImage(node.url)) {
      code = "image_not_allowed";
      return SKIP;
    }

    return;
  });

  return code;
}

function isAllowedLink(url: string): boolean {
  if (url.startsWith("//")) {
    return false;
  }

  if (url.startsWith("/")) {
    return isAllowedPath(url);
  }

  const scheme = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(url)?.[1].toLowerCase();

  return scheme === "https" || scheme === "mailto";
}

function isAllowedPath(url: string): boolean {
  if (url.startsWith("/users/")) {
    return ID_PATTERN.test(url.slice("/users/".length));
  }

  if (url.startsWith("/pages/")) {
    return ID_PATTERN.test(url.slice("/pages/".length));
  }

  return true;
}

function isAllowedImage(url: string): boolean {
  if (!url.startsWith("/fs/")) {
    return false;
  }

  return ID_PATTERN.test(url.slice("/fs/".length));
}

function listDepth(node: Root): number {
  let maximum = 0;

  function walk(current: Nodes, depth: number): void {
    const nextDepth = current.type === "list" ? depth + 1 : depth;

    if (current.type === "list") {
      maximum = Math.max(maximum, nextDepth);
    }

    if ("children" in current) {
      for (const child of current.children) {
        walk(child, nextDepth);
      }
    }
  }

  walk(node, 0);

  return maximum;
}

function failure(code: MarkdownErrorCode): MarkdownValidation {
  return { ok: false, code, message: ERROR_MESSAGES[code] };
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

const SHA256_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotateRight(value: number, shift: number): number {
  return (value >>> shift) | (value << (32 - shift));
}

/**
 * Returns the SHA-256 hash of a string.
 * The function is synchronous, so validation can return a hash.
 */
function sha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const buffer = new Uint8Array(paddedLength);
  buffer.set(bytes);
  buffer[bytes.length] = 0x80;

  const view = new DataView(buffer.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000));
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const words = new Uint32Array(64);

  for (let offset = 0; offset < buffer.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4);
    }

    for (let index = 16; index < 64; index += 1) {
      const previous = words[index - 15];
      const next = words[index - 2];
      const s0 =
        rotateRight(previous, 7) ^ rotateRight(previous, 18) ^ (previous >>> 3);
      const s1 = rotateRight(next, 17) ^ rotateRight(next, 19) ^ (next >>> 10);

      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let index = 0; index < 64; index += 1) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temporary1 =
        (h + s1 + choose + SHA256_CONSTANTS[index] + words[index]) >>> 0;
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (s0 + majority) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((value) => value.toString(16).padStart(8, "0"))
    .join("");
}
