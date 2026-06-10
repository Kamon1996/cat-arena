"use client";

import { Check, Pencil, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { renameCat } from "@/cats/owner-actions";
import { catToast } from "@/components/ui/cat-toast";
import { cn } from "@/lib/utils";

type RenameCatFormProps = {
  catId: string;
  currentName: string;
  disabled?: boolean;
};

// One family of round sticker icon-buttons: pencil (view) and ✓/✕ (edit).
const ICON_BUTTON_CLASS = cn(
  "grid size-7.5 shrink-0 place-items-center rounded-full border-2 border-ink bg-card",
  "text-foreground shadow-sticker-press transition-[scale,background-color,color] duration-150",
  "ease-spring hover:scale-110 disabled:opacity-40",
);

// The name keeps the exact same typography in both modes, so entering edit
// mode just drops a caret into the text — nothing reflows or jumps.
const NAME_TEXT_CLASS = "font-display text-[28px] font-bold tracking-[-.01em] leading-tight";

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

  function cancel(): void {
    setEditing(false);
    setName(currentName);
  }

  if (!editing) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <h3 className={cn("truncate", NAME_TEXT_CLASS)}>{currentName}</h3>
        {disabled ? null : (
          <button
            type="button"
            aria-label="Rename cat"
            className={ICON_BUTTON_CLASS}
            onClick={() => {
              setName(currentName);
              setEditing(true);
            }}
          >
            <Pencil className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
    );
  }

  return (
    <form
      className="flex min-w-0 flex-1 items-center gap-2.5"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      {/* Chrome-less input sized EXACTLY to its text: an invisible replica span
          and the input share one grid cell, so the cell tracks the text width.
          The ✓/✕ buttons therefore hug the name (where the pencil was) and the
          card never changes width. */}
      <span className="inline-grid min-w-0 max-w-full items-center overflow-hidden">
        <span
          aria-hidden
          className={cn("invisible col-start-1 row-start-1 whitespace-pre", NAME_TEXT_CLASS)}
        >
          {name || " "}
        </span>
        <input
          // biome-ignore lint/a11y/noAutofocus: edit-in-place — the user just clicked "Rename", moving focus into the field IS the expected outcome
          autoFocus
          size={1}
          value={name}
          disabled={saving}
          aria-label="Cat name"
          className={cn(
            "col-start-1 row-start-1 w-full min-w-0 border-none bg-transparent p-0 caret-primary outline-none",
            NAME_TEXT_CLASS,
          )}
          onFocus={(e) => {
            const end = e.currentTarget.value.length;
            e.currentTarget.setSelectionRange(end, end);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              cancel();
            }
          }}
          onChange={(e) => setName(e.target.value)}
        />
      </span>
      <button
        type="submit"
        aria-label="Save name"
        disabled={saving}
        className={cn(ICON_BUTTON_CLASS, "hover:bg-emerald-500 hover:text-destructive-foreground")}
      >
        <Check className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Cancel rename"
        disabled={saving}
        onClick={cancel}
        className={cn(ICON_BUTTON_CLASS, "hover:bg-destructive hover:text-destructive-foreground")}
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </form>
  );
}
