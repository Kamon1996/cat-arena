import { requireModerator } from "@/auth/guards";
import { ModerationQueue } from "@/components/admin/moderation-queue";
import { ReportQueue } from "@/components/admin/report-queue";

export default async function AdminPage() {
  await requireModerator();
  return (
    <main>
      <h1>Moderation</h1>
      <ModerationQueue />
      <ReportQueue />
    </main>
  );
}
