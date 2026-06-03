import type { Decorator, Preview } from "@storybook/nextjs-vite";

import "../src/app/globals.css";

const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme ?? "light";
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }
  return (
    <div className="min-h-svh bg-background p-6 text-foreground">
      <Story />
    </div>
  );
};

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    layout: "fullscreen",
  },
  initialGlobals: { theme: "light" },
  globalTypes: {
    theme: {
      description: "Light / dark theme",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [withTheme],
};

export default preview;
