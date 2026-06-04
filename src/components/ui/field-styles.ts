/**
 * Shared "sticker field" chrome for text inputs, textareas and the select
 * trigger — so all three controls share one look (2px ink outline + a pressed-in
 * shadow that lifts on hover/focus). Compose with each control's own size/text
 * classes via `cn(STICKER_FIELD, "...", className)`.
 *
 * Focus indicator: the lift + ring-coloured border IS the indicator; a CSS
 * `outline` (not Tailwind's box-shadow `ring`) adds the keyboard halo without
 * fighting the sticker box-shadow. Invalid styling is driven by `aria-invalid`
 * (set by the forms), matching the rest of the app.
 */
export const STICKER_FIELD = [
  "border-2 border-ink bg-card text-foreground shadow-sticker-press outline-none",
  "transition-[transform,box-shadow,border-color] duration-150 ease-spring",
  "enabled:hover:-translate-x-0.5 enabled:hover:-translate-y-0.5 enabled:hover:shadow-sticker",
  "focus:-translate-x-0.5 focus:-translate-y-0.5 focus:border-ring focus:shadow-sticker",
  // outline-solid re-asserts the style while focused — the base outline-none pins
  // --tw-outline-style:none, which would otherwise make outline-2 paint nothing.
  "focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring",
  "aria-invalid:border-destructive aria-invalid:shadow-[2px_2px_0_var(--destructive)]",
  "aria-invalid:focus:border-destructive aria-invalid:focus:shadow-[4px_4px_0_var(--destructive)]",
  "disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none",
].join(" ");
