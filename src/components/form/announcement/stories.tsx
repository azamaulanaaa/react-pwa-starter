import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  FormAnnouncement,
  type FormAnnouncementValue,
} from "@/components/form/announcement/index.tsx";
import type { ImageUploadHandler } from "@/components/editor/image-upload.ts";

const meta = {
  title: "Form / Announcement",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

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

export const Base: Story = {
  render: () => {
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
  },
};
