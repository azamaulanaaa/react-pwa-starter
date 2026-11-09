import { useRef, useState } from "react";
import type { Story, StoryDefault } from "@ladle/react";

import {
  createLocalMentionSource,
  LOCAL_MENTION_TARGETS,
  type MentionSource,
} from "@/lib/mentions/index.ts";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
  type MarkdownEditorVariant,
} from "@/components/editor/markdown-editor.tsx";
import type { ImageUploadHandler } from "@/components/editor/image-upload.ts";
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

const MENTION_MARKDOWN = [
  "# Mentions",
  "",
  "Ask [Alex Morgan](/users/alex-morgan) about the [Product Roadmap](/pages/product-roadmap).",
  "",
  "Type `@` to add a user or a page.",
].join("\n");

const LOCAL_MENTION_SOURCE = createLocalMentionSource(LOCAL_MENTION_TARGETS);

const IMAGE_MARKDOWN = [
  "# Image note",
  "",
  "![Sample diagram](/fs/story_image)",
  "",
  "Use the image button to upload one image.",
].join("\n");

/** Returns one fake upload result for the image story. */
const FAKE_IMAGE_UPLOAD: ImageUploadHandler = async (file, { onProgress }) => {
  onProgress(100);
  return { alt: file.name, id: "story_image" };
};

/** Shows one editor and the Markdown that it emits. */
function EditorStory({
  initialMarkdown,
  mentionSource,
  onUploadImage,
  readOnly = false,
  showMentions,
  variant = "standard",
}: {
  initialMarkdown: string;
  mentionSource?: MentionSource;
  onUploadImage?: ImageUploadHandler;
  readOnly?: boolean;
  showMentions?: boolean;
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
          mentionSource={mentionSource}
          onChange={setMarkdown}
          onUploadImage={onUploadImage}
          placeholder="# Project notes"
          readOnly={readOnly}
          showMentions={showMentions}
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

export const Mentions: Story = () => (
  <EditorStory
    initialMarkdown={MENTION_MARKDOWN}
    mentionSource={LOCAL_MENTION_SOURCE}
  />
);

export const Images: Story = () => (
  <EditorStory
    initialMarkdown={IMAGE_MARKDOWN}
    onUploadImage={FAKE_IMAGE_UPLOAD}
  />
);

export const Plain: Story = () => (
  <EditorStory initialMarkdown={PLAIN_MARKDOWN} variant="plain" />
);

export const ReadOnly: Story = () => (
  <EditorStory initialMarkdown={DEFAULT_MARKDOWN} readOnly />
);

export const Empty: Story = () => <EditorStory initialMarkdown="" />;

/** Shows the editor at the 320px reflow width. */
export const Narrow: Story = () => (
  <div className="w-80 max-w-full">
    <EditorStory initialMarkdown={DEFAULT_MARKDOWN} />
  </div>
);
