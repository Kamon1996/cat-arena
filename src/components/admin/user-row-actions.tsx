"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { banUser, setUserRole, unbanUser } from "@/admin/user-actions";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type AdminUserRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: "USER" | "MODERATOR" | "ADMIN";
  banned: boolean;
  cats: number;
  joined: string;
};

export function UserRowActions({
  user,
  currentUserId,
}: {
  user: AdminUserRow;
  currentUserId: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // ADMINs and yourself cannot be acted on.
  if (user.role === "ADMIN" || user.id === currentUserId) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  async function onRole(role: string): Promise<void> {
    setBusy(true);
    const result = await setUserRole(user.id, role);
    setBusy(false);
    if (result.ok) {
      toast.success("Role updated");
      router.refresh();
    } else {
      toast.error(`Could not change role (${result.error})`);
    }
  }

  async function onBanToggle(): Promise<void> {
    if (
      !user.banned &&
      !window.confirm(`Ban ${user.email ?? "this user"}? Their cats will be deleted.`)
    ) {
      return;
    }
    setBusy(true);
    const result = user.banned ? await unbanUser(user.id) : await banUser(user.id);
    setBusy(false);
    if (result.ok) {
      toast.success(user.banned ? "User unbanned" : "User banned");
      router.refresh();
    } else {
      toast.error(`Action failed (${result.error})`);
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Select defaultValue={user.role} disabled={busy} onValueChange={(v) => void onRole(v)}>
        <SelectTrigger size="sm" className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="USER">User</SelectItem>
          <SelectItem value="MODERATOR">Moderator</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant={user.banned ? "outline" : "destructive"}
        disabled={busy}
        onClick={() => void onBanToggle()}
      >
        {user.banned ? "Unban" : "Ban"}
      </Button>
    </div>
  );
}
