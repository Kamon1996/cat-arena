import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  cat: { findUnique: vi.fn(), update: vi.fn() },
  report: { create: vi.fn(), count: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  },
}));

import { createReport } from "./reports";

const CAT_ID = "cat_1";
const REPORTER = "anon:abc";

describe("createReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.cat.findUnique.mockResolvedValue({ id: CAT_ID, status: "ACTIVE" });
    tx.report.create.mockResolvedValue({ id: "rep_1" });
  });

  it("returns notFound when the cat does not exist", async () => {
    tx.cat.findUnique.mockResolvedValueOnce(null);
    const result = await createReport({ catId: CAT_ID, reporter: REPORTER });
    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(tx.report.create).not.toHaveBeenCalled();
  });

  it("inserts a report and does not hide below the threshold", async () => {
    tx.report.count.mockResolvedValueOnce(2); // below REPORT_HIDE_THRESHOLD (5)
    const result = await createReport({
      catId: CAT_ID,
      reporter: REPORTER,
      reason: "spam",
    });
    expect(result).toEqual({ ok: true, hidden: false });
    expect(tx.report.create).toHaveBeenCalledOnce();
    expect(tx.cat.update).not.toHaveBeenCalled();
  });

  it("auto-hides the cat at the report threshold", async () => {
    tx.report.count.mockResolvedValueOnce(5); // == REPORT_HIDE_THRESHOLD
    const result = await createReport({ catId: CAT_ID, reporter: REPORTER });
    expect(result).toEqual({ ok: true, hidden: true });
    expect(tx.cat.update).toHaveBeenCalledWith({
      where: { id: CAT_ID },
      data: { status: "HIDDEN" },
    });
  });
});
