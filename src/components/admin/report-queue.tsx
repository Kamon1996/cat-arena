import { revalidatePath } from "next/cache";

import { requireModerator } from "@/auth/guards";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { banCat, deleteCat, hideCat } from "@/moderation/admin-actions";

const ADMIN_PATH = "/admin";
const REPORT_QUEUE_LIMIT = 50;

async function hideAction(formData: FormData): Promise<void> {
  "use server";
  await requireModerator();
  await hideCat(String(formData.get("catId")));
  revalidatePath(ADMIN_PATH);
}

async function banAction(formData: FormData): Promise<void> {
  "use server";
  await requireModerator();
  await banCat(String(formData.get("catId")));
  revalidatePath(ADMIN_PATH);
}

async function deleteAction(formData: FormData): Promise<void> {
  "use server";
  await requireModerator();
  await deleteCat(String(formData.get("catId")));
  revalidatePath(ADMIN_PATH);
}

export async function ReportQueue() {
  const grouped = await prisma.report.groupBy({
    by: ["catId"],
    _count: { catId: true },
    orderBy: { _count: { catId: "desc" } },
    take: REPORT_QUEUE_LIMIT,
  });

  const catIds = grouped.map((g) => g.catId);
  const cats = await prisma.cat.findMany({
    where: { id: { in: catIds } },
    select: { id: true, name: true, slug: true, status: true },
  });
  const byId = new Map(cats.map((c) => [c.id, c]));

  return (
    <section aria-labelledby="reports-heading" className="flex flex-col gap-4">
      <h2 id="reports-heading" className="flex items-center gap-2 font-semibold text-lg">
        Reported cats
        <Badge variant="secondary">{grouped.length}</Badge>
      </h2>

      {grouped.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
          No reports.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {grouped.map((row) => {
            const cat = byId.get(row.catId);
            if (!cat) {
              return null;
            }
            return (
              <li
                key={row.catId}
                className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
              >
                <span className="font-medium">{cat.name}</span>
                <Badge variant="destructive">{row._count.catId} reports</Badge>
                <StatusBadge status={cat.status} />
                <div className="ml-auto flex flex-wrap gap-2">
                  <form action={hideAction}>
                    <input type="hidden" name="catId" value={cat.id} />
                    <Button type="submit" size="sm" variant="secondary">
                      Hide
                    </Button>
                  </form>
                  <form action={banAction}>
                    <input type="hidden" name="catId" value={cat.id} />
                    <Button type="submit" size="sm" variant="destructive">
                      Ban
                    </Button>
                  </form>
                  <form action={deleteAction}>
                    <input type="hidden" name="catId" value={cat.id} />
                    <Button type="submit" size="sm" variant="destructive">
                      Delete
                    </Button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
