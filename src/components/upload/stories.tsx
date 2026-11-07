import type { Story, StoryDefault } from "@ladle/react";

import { FileUpload } from "@/components/upload/file-upload.tsx";
import type { FileMetadata } from "@/hooks/primitives/use-file-upload.ts";

export default {
  title: "Upload",
} as StoryDefault;

const IMAGE_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

const SAMPLE_FILES: FileMetadata[] = [
  {
    id: "intro-zip",
    name: "intro.zip",
    size: 252873,
    type: "application/zip",
    url: "https://example.com/intro.zip",
  },
  {
    id: "image-01",
    name: "image-01.png",
    size: 1528737,
    type: "image/png",
    url: IMAGE_URL,
  },
  {
    id: "audio-01",
    name: "audio.mp3",
    size: 1528737,
    type: "audio/mpeg",
    url: "https://example.com/audio.mp3",
  },
];

export const Empty: Story = () => (
  <div className="max-w-2xl p-6">
    <FileUpload />
  </div>
);

export const WithFiles: Story = () => (
  <div className="max-w-2xl p-6">
    <FileUpload initialFiles={SAMPLE_FILES} />
  </div>
);

export const SingleFile: Story = () => (
  <div className="max-w-2xl p-6">
    <FileUpload
      initialFiles={[SAMPLE_FILES[1]]}
      maxFiles={1}
      multiple={false}
    />
  </div>
);

export const WithProgress: Story = () => (
  <div className="max-w-2xl p-6">
    <FileUpload
      busy
      initialFiles={SAMPLE_FILES}
      progressByFileId={{ "audio-01": 0.75, "image-01": 0.42 }}
    />
  </div>
);

export const WithError: Story = () => (
  <div className="max-w-2xl p-6">
    <FileUpload
      busy={false}
      errorsByFileId={{ "intro-zip": "The upload failed. Try again." }}
      initialFiles={SAMPLE_FILES}
    />
  </div>
);
