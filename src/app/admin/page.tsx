import { requireModerator } from "@/auth/guards";
import { ModerationList } from "@/components/admin/moderation-list";
import { ReportQueue } from "@/components/admin/report-queue";
import { getModerationCats } from "@/moderation/moderation-queue";

export default async function AdminPage() {
  const session = await requireModerator();
  const first = await getModerationCats();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="font-bold text-2xl tracking-tight">Moderation</h1>
      <p className="mb-6 text-muted-foreground text-sm">Review pending cat images.</p>
      <ModerationList
        initial={first}
        isAdmin={session.user.role === "ADMIN"}
        currentUserId={session.user.id}
      />
      <div className="mt-10">
        <ReportQueue />
      </div>
    </main>
  );
}
