import { type ReactNode, useEffect } from "react";
import type { Preview } from "@storybook/react-vite";

import "./preview.css";
import { useNavigatorLanguage } from "@/hooks/primitives/use-navigator-language.ts";
import { TranslationProvider } from "@/components/context/translation.tsx";
import { IntlProvider } from "@/components/context/intl.tsx";
import dictionary from "../public/locales/en-US.json" with { type: "json" };

/** Wraps a story in the app providers and applies the theme class. */
function PreviewProvider({
  children,
  theme,
}: {
  children: ReactNode;
  theme: string;
}) {
  const isDarkMode = theme === "dark";
  const locale = useNavigatorLanguage();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode);
  }, [isDarkMode]);

  return (
    <TranslationProvider
      dictionary={dictionary}
      fallbackDictionary={dictionary}
    >
      <IntlProvider locale={locale}>{children}</IntlProvider>
    </TranslationProvider>
  );
}

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Color theme for the preview",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light", icon: "sun" },
          { value: "dark", title: "Dark", icon: "moon" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "light",
  },
  decorators: [
    (Story, context) => (
      <PreviewProvider theme={String(context.globals.theme)}>
        <Story />
      </PreviewProvider>
    ),
  ],
};

export default preview;
