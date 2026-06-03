import type { Decorator, Preview } from "@storybook/nextjs-vite";

import "../src/app/globals.css";

// Toggle the `.dark` class the design tokens key off. We do NOT wrap stories in a
// full-height padded container — that forced every component (even a tiny Badge)
// to fill the canvas. The themed background comes from `body { @apply bg-background }`
// in globals.css (the body background paints the whole canvas), and per-story spacing
// is controlled by the Storybook `layout` parameter (centered / padded / fullscreen).
const withTheme: Decorator = (Story, context) => {
  const theme = context.globals.theme ?? "light";
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }
  return <Story />;
};

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    // Sensible default for a component library; page-view stories opt into "fullscreen".
    layout: "centered",
    // App-Router project: mock next/navigation so components calling useRouter()
    // (CatCard, forms, moderation actions…) render instead of throwing
    // "invariant expected app router to be mounted". Navigation calls log to Actions.
    nextjs: { appDirectory: true },
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
