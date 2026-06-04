import { requireAdmin } from "@/auth/guards";
import type { AdminUserRow } from "@/components/admin/user-row-actions";
import { UsersTable } from "@/components/admin/users-table";
import { ADMIN_USERS_PAGE_SIZE } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await requireAdmin();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const skip = (page - 1) * ADMIN_USERS_PAGE_SIZE;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: ADMIN_USERS_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        banned: true,
        createdAt: true,
        _count: { select: { cats: true } },
      },
    }),
    prisma.user.count(),
  ]);

  const rows: AdminUserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    banned: u.banned,
    cats: u._count.cats,
    joined: u.createdAt.toISOString(),
  }));

  const pageCount = Math.max(1, Math.ceil(total / ADMIN_USERS_PAGE_SIZE));

  return (
    <main>
      <h1 className="mb-1 font-bold text-2xl tracking-tight">Users</h1>
      <p className="mb-6 text-muted-foreground text-sm">{total} users · manage roles and bans.</p>
      <UsersTable
        rows={rows}
        pageIndex={page - 1}
        pageCount={pageCount}
        currentUserId={session.user.id}
      />
    </main>
  );
}
