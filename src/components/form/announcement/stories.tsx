import type { Story, StoryDefault } from "@ladle/react";

import {
  FormAnnouncement,
  type FormAnnouncementValue,
} from "@/components/form/announcement/index.tsx";
import type { ImageUploadHandler } from "@/components/editor/image-upload.ts";

export default {
  title: "Form / Announcement",
} as StoryDefault;

/** Returns one fake upload result. The story does not call the worker. */
const FAKE_IMAGE_UPLOAD: ImageUploadHandler = async (file, { onProgress }) => {
  onProgress(100);
  return { alt: file.name, id: "story_image" };
};

const DEFAULT_VALUE: FormAnnouncementValue = {
  title: "Maintenance tonight",
  body: "Ask [Alex Morgan](/users/alex-morgan) before you deploy.",
  variant: "info",
  preferredPresentation: "banner",
};

export const Base: Story = () => {
  const handleSubmit = (value: FormAnnouncementValue) => {
    console.log(value);
  };

  return (
    <div className="p-6">
      <FormAnnouncement
        defaultValues={DEFAULT_VALUE}
        onSubmit={handleSubmit}
        onUploadImage={FAKE_IMAGE_UPLOAD}
      />
    </div>
  );
};
