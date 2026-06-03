import tsParser from "@typescript-eslint/parser";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";

// ESLint is used ONLY for Tailwind class validation (catching unknown/typo'd utility
// classes that Biome and tsc can't see). Formatting + JS/TS linting stay with Biome.
// The plugin already understands className + cva()/cn()/clsx()/twMerge() by default;
// `entryPoint` points it at our Tailwind v4 CSS so the @theme tokens (bg-background,
// text-foreground, …) count as known classes.
export default [
  {
    files: ["src/**/*.{ts,tsx}"],
    // Vendored shadcn primitives use intentional non-Tailwind marker classes
    // (e.g. Sonner's "toaster") — don't police generated UI for unknown classes.
    ignores: ["src/components/ui/**"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { "better-tailwindcss": betterTailwindcss },
    settings: {
      "better-tailwindcss": {
        entryPoint: "src/app/globals.css",
      },
    },
    rules: {
      "better-tailwindcss/no-unknown-classes": "error",
    },
  },
];
