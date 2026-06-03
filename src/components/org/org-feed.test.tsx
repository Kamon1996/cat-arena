import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/duel/duel-arena", () => ({
  DuelArena: ({ scope }: { scope?: string }) => <div data-testid="duel-arena">scope:{scope}</div>,
}));

import { OrgFeed } from "@/components/org/org-feed";

const ORG_ID = "org-1";

describe("OrgFeed", () => {
  it("renders the org-scoped duel arena for a member", () => {
    render(<OrgFeed orgId={ORG_ID} canVote />);
    expect(screen.getByTestId("duel-arena")).toHaveTextContent(`scope:${ORG_ID}`);
  });

  it("renders a members-only prompt for a non-member", () => {
    render(<OrgFeed orgId={ORG_ID} canVote={false} />);
    expect(screen.queryByTestId("duel-arena")).not.toBeInTheDocument();
    expect(screen.getByText(/members only/i)).toBeInTheDocument();
  });
});
