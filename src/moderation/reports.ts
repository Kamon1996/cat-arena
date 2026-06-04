import { REPORT_HIDE_THRESHOLD } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export type CreateReportInput = {
  catId: string;
  reporter: string; // anonId or "user:<id>"
  reason?: string | undefined;
};

export type CreateReportResult = { ok: true; hidden: boolean } | { ok: false; reason: "not_found" };

/**
 * Insert a Report and, if the cat crosses REPORT_HIDE_THRESHOLD, auto-set its
 * status to HIDDEN. Returns whether the cat was hidden by this report.
 */
export async function createReport(input: CreateReportInput): Promise<CreateReportResult> {
  return prisma.$transaction(async (tx) => {
    const cat = await tx.cat.findUnique({
      where: { id: input.catId },
      select: { id: true, status: true },
    });
    if (!cat) {
      return { ok: false, reason: "not_found" } as const;
    }

    await tx.report.create({
      data: {
        catId: input.catId,
        reporter: input.reporter,
        reason: input.reason ?? null,
      },
    });

    const total = await tx.report.count({ where: { catId: input.catId } });
    if (total >= REPORT_HIDE_THRESHOLD && cat.status !== "HIDDEN") {
      await tx.cat.update({
        where: { id: input.catId },
        data: { status: "HIDDEN" },
      });
      return { ok: true, hidden: true } as const;
    }
    return { ok: true, hidden: false } as const;
  });
}
