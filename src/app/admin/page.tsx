import { requireModerator } from "@/auth/guards";
import { ModerationQueue } from "@/components/admin/moderation-queue";
import { ReportQueue } from "@/components/admin/report-queue";

export default async function AdminPage() {
  await requireModerator();
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="font-bold text-2xl tracking-tight">Moderation</h1>
      <p className="mb-6 text-muted-foreground text-sm">Review pending images and reported cats.</p>
      <div className="flex flex-col gap-10">
        <ModerationQueue />
        <ReportQueue />
      </div>
    </main>
  );
}
