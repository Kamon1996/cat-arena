import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { OrgCreateForm } from "@/components/org/org-create-form";

describe("OrgCreateForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a validation error when the name is too short", async () => {
    const user = userEvent.setup();
    render(<OrgCreateForm />);
    await user.click(screen.getByRole("button", { name: /create organization/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("posts the org and redirects to the new org page on success", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: "org-1", slug: "acme-org01", joinCode: "code-x" }), {
          status: 201,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<OrgCreateForm />);
    await user.type(screen.getByLabelText(/name/i), "Acme");
    await user.click(screen.getByRole("button", { name: /create organization/i }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/orgs",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/org/acme-org01"));
  });
});
