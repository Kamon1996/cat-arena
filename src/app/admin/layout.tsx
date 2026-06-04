import { requireModerator } from "@/auth/guards";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireModerator();
  const isAdmin = session.user.role === "ADMIN";

  return (
    <SidebarProvider>
      <AdminSidebar isAdmin={isAdmin} />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <span className="font-semibold">Admin</span>
        </header>
        <div className="p-4">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
