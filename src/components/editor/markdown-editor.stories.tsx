import { useRef, useState } from "react";
import type { Story, StoryDefault } from "@ladle/react";

import {
  MarkdownEditor,
  type MarkdownEditorHandle,
  type MarkdownEditorVariant,
} from "@/components/editor/markdown-editor.tsx";
import { MarkdownView } from "@/components/markdown/markdown-view.tsx";

const DEFAULT_MARKDOWN = [
  "# Project notes",
  "",
  "A short **bold** and ~~struck~~ note with an inline [link](https://example.com).",
  "",
  "- one",
  "- two",
  "",
  "> The editor returns canonical Markdown.",
].join("\n");

const PLAIN_MARKDOWN = [
  "A plain note with a **bold** word and a [link](https://example.com).",
  "",
  "# This heading stays as text in the plain variant.",
].join("\n");

/** Shows one editor and the Markdown that it emits. */
function EditorStory({
  initialMarkdown,
  readOnly = false,
  variant = "standard",
}: {
  initialMarkdown: string;
  readOnly?: boolean;
  variant?: MarkdownEditorVariant;
}) {
  const [markdown, setMarkdown] = useState(initialMarkdown);
  const editorRef = useRef<MarkdownEditorHandle>(null);

  return (
    <div className="grid gap-6 p-6 lg:grid-cols-2">
      <div>
        <MarkdownEditor
          ref={editorRef}
          ariaLabel="Story note"
          onChange={setMarkdown}
          placeholder="# Project notes"
          readOnly={readOnly}
          value={markdown}
          variant={variant}
        />
      </div>
      <div>
        <MarkdownView markdown={markdown} />
      </div>
    </div>
  );
}

export default {
  title: "Editor",
} as StoryDefault;

export const Standard: Story = () => (
  <EditorStory initialMarkdown={DEFAULT_MARKDOWN} />
);

export const Plain: Story = () => (
  <EditorStory initialMarkdown={PLAIN_MARKDOWN} variant="plain" />
);

export const ReadOnly: Story = () => (
  <EditorStory initialMarkdown={DEFAULT_MARKDOWN} readOnly />
);

export const Empty: Story = () => <EditorStory initialMarkdown="" />;
