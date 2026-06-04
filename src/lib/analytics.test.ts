import { beforeEach, describe, expect, it, vi } from "vitest";

const capture = vi.fn();
vi.mock("posthog-js", () => ({
  default: { capture: (...a: unknown[]) => capture(...a) },
}));

import { captureEvent } from "@/lib/analytics";
import { ANALYTICS_EVENT } from "@/lib/constants";

describe("captureEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the event name and properties to posthog", () => {
    captureEvent(ANALYTICS_EVENT.VOTE_CAST, { winner_cat_id: "ca", loser_cat_id: "cb" });
    expect(capture).toHaveBeenCalledWith(ANALYTICS_EVENT.VOTE_CAST, {
      winner_cat_id: "ca",
      loser_cat_id: "cb",
    });
  });

  it("captures an event with no properties", () => {
    captureEvent(ANALYTICS_EVENT.SKIP);
    expect(capture).toHaveBeenCalledWith(ANALYTICS_EVENT.SKIP, undefined);
  });
});
