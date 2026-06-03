import { fn } from "storybook/test";

import type { ModerationPage } from "@/moderation/moderation-types";

// Browser-safe stand-in for the "use server" data action (aliased in main.ts).
// "Load more" in stories resolves to an empty next page.
export const getModerationCats = fn(
  async (): Promise<ModerationPage> => ({ cats: [], nextCursor: null }),
).mockName("getModerationCats");
