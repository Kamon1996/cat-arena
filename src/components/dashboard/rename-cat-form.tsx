"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { renameCat } from "@/cats/owner-actions";

type RenameCatFormProps = {
  catId: string;
  currentName: string;
  disabled?: boolean;
};

export function RenameCatForm({ catId, currentName, disabled }: RenameCatFormProps) {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  async function save(): Promise<void> {
    if (name.trim() === currentName || saving) {
      return;
    }
    setSaving(true);
    const result = await renameCat(catId, name);
    setSaving(false);
    if (result.ok) {
      toast.success("Name updated");
      router.refresh();
    } else {
      toast.error(`Could not rename (${result.error})`);
      setName(currentName);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label htmlFor={`name-${catId}`}>Cat name</label>
      <input
        id={`name-${catId}`}
        value={name}
        disabled={disabled || saving}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => void save()}
      />
      <button type="submit" disabled={disabled || saving}>
        Save
      </button>
    </form>
  );
}
