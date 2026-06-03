import { revalidatePath } from "next/cache";

import { requireModerator } from "@/auth/guards";
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
    <section aria-labelledby="reports-heading">
      <h2 id="reports-heading">Reported cats ({grouped.length})</h2>
      <ul>
        {grouped.map((row) => {
          const cat = byId.get(row.catId);
          if (!cat) {
            return null;
          }
          return (
            <li key={row.catId}>
              <span>
                {cat.name} — {row._count.catId} reports — {cat.status}
              </span>
              <form action={hideAction}>
                <input type="hidden" name="catId" value={cat.id} />
                <button type="submit">Hide</button>
              </form>
              <form action={banAction}>
                <input type="hidden" name="catId" value={cat.id} />
                <button type="submit">Ban</button>
              </form>
              <form action={deleteAction}>
                <input type="hidden" name="catId" value={cat.id} />
                <button type="submit">Delete</button>
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
