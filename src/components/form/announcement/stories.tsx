import type { Story, StoryDefault } from "@ladle/react";

import {
  FormAnnouncement,
  type FormAnnouncementValue,
} from "@/components/form/announcement/index.tsx";

export default {
  title: "Form / Announcement",
} as StoryDefault;

export const Base: Story = () => {
  const handleSubmit = (value: FormAnnouncementValue) => {
    console.log(value);
  };

  return (
    <div className="p-6">
      <FormAnnouncement onSubmit={handleSubmit} />
    </div>
  );
};
