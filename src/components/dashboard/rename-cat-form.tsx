"use client";

import { Check, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { renameCat } from "@/cats/owner-actions";
import { Button } from "@/components/ui/button";
import { catToast } from "@/components/ui/cat-toast";
import { Input } from "@/components/ui/input";

type RenameCatFormProps = {
  catId: string;
  currentName: string;
  disabled?: boolean;
};

export function RenameCatForm({ catId, currentName, disabled }: RenameCatFormProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  async function save(): Promise<void> {
    if (saving) {
      return;
    }
    if (name.trim() === currentName) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const result = await renameCat(catId, name);
    setSaving(false);
    if (result.ok) {
      catToast.success("Name updated");
      setEditing(false);
      router.refresh();
    } else {
      catToast.error("Could not rename", { message: result.error });
    }
  }

  if (!editing) {
    return (
      <div className="flex min-w-0 items-center gap-1.5">
        <h3 className="truncate font-semibold text-lg leading-tight">{currentName}</h3>
        {disabled ? null : (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Rename cat"
            onClick={() => {
              setName(currentName);
              setEditing(true);
            }}
          >
            <Pencil />
          </Button>
        )}
      </div>
    );
  }

  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Input
        autoFocus
        value={name}
        disabled={saving}
        aria-label="Cat name"
        className="h-8"
        onChange={(e) => setName(e.target.value)}
      />
      <Button type="submit" size="icon-sm" disabled={saving} aria-label="Save name">
        <Check />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={saving}
        aria-label="Cancel rename"
        onClick={() => {
          setEditing(false);
          setName(currentName);
        }}
      >
        <X />
      </Button>
    </form>
  );
}
