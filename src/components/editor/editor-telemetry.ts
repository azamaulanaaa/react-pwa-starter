/**
 * Safe telemetry for the Markdown editor.
 *
 * The module records event counts only. It never sends Markdown content, a
 * label, a URL, a file name, or a user id. A telemetry failure must not break
 * the editor.
 */
import type { Attributes, Counter } from "@opentelemetry/api";

import { getMeter } from "@/telemetry/api.ts";

/** Lists the event names that the editor can record. */
export type EditorEventName =
  | "editor.markdown.invalid"
  | "editor.markdown.unsupported"
  | "editor.upload.failed"
  | "editor.mention.search_failed"
  | "editor.link.invalid"
  | "editor.unknown_node_export";

/** Lists the event names in one stable order. */
const EVENT_NAMES: readonly EditorEventName[] = [
  "editor.markdown.invalid",
  "editor.markdown.unsupported",
  "editor.upload.failed",
  "editor.mention.search_failed",
  "editor.link.invalid",
  "editor.unknown_node_export",
];

/** Lists the attribute keys that can carry a safe value. */
const SAFE_ATTRIBUTE_KEYS = new Set(["code", "feature", "reason", "retryable"]);

/** Matches one value that can carry a URL. */
const URL_VALUE = /(?:[a-z][a-z\d+.-]*:\/\/|^\/|^www\.)/i;

/** Matches one value that can carry Markdown syntax or a line break. */
const MARKDOWN_VALUE = /[#*`[\]|<>]|[\r\n]/;

/** Defines the counter set. One counter exists for each event name. */
type CounterSet = Partial<Record<EditorEventName, Counter>>;

/**
 * Creates one counter for each event name.
 * The function returns the counters that it made before a failure.
 */
function createCounters(): CounterSet {
  const counters: CounterSet = {};

  try {
    const meter = getMeter("editor");

    for (const name of EVENT_NAMES) {
      counters[name] = meter.createCounter(name);
    }
  } catch {
    // Telemetry must never break the editor. The missing counters stay no-ops.
  }

  return counters;
}

const COUNTERS = createCounters();

/**
 * Removes each attribute that can carry an unsafe value.
 * The function keeps a short string, a number, or a boolean under one safe key.
 */
function sanitizeAttributes(
  attributes?: Record<string, string | number | boolean>,
): Attributes | undefined {
  if (attributes === undefined) return undefined;

  const safe: Attributes = {};

  for (const [key, value] of Object.entries(attributes)) {
    if (!SAFE_ATTRIBUTE_KEYS.has(key)) continue;

    if (typeof value === "string") {
      if (
        value.length > 64 ||
        URL_VALUE.test(value) ||
        MARKDOWN_VALUE.test(value)
      ) {
        continue;
      }

      safe[key] = value;
      continue;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      safe[key] = value;
    }
  }

  return safe;
}

/**
 * Records one editor event.
 * A telemetry failure does not throw to the caller.
 */
export function recordEditorEvent(
  name: EditorEventName,
  attributes?: Record<string, string | number | boolean>,
): void {
  try {
    const counter = COUNTERS[name];

    if (counter === undefined) return;

    const safeAttributes = sanitizeAttributes(attributes);

    if (safeAttributes === undefined) {
      counter.add(1);
      return;
    }

    counter.add(1, safeAttributes);
  } catch {
    // Telemetry must never break the editor.
  }
}
