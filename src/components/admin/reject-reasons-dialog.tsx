"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { REJECTION_REASONS } from "@/moderation/moderation-types";

export interface RejectReasonsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired when the moderator confirms with ≥1 reason. */
  onConfirm: (reasons: string[]) => void;
  /** Cat name for the title. */
  catName?: string;
  /** Disable the Reject button while the action runs. */
  pending?: boolean;
}

/**
 * Modal for choosing one or more rejection reasons. Closing it (×, overlay, Esc,
 * or Cancel) does nothing; only the bottom-right Reject button — enabled once a
 * reason is picked — confirms.
 */
export function RejectReasonsDialog({
  open,
  onOpenChange,
  onConfirm,
  catName,
  pending = false,
}: RejectReasonsDialogProps) {
  const [selected, setSelected] = useState<string[]>([]);

  // Start fresh every time the dialog opens.
  useEffect(() => {
    if (open) {
      setSelected([]);
    }
  }, [open]);

  const toggle = (reason: string) => {
    setSelected((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason],
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject {catName ?? "submission"}?</DialogTitle>
          <DialogDescription>
            Pick one or more reasons — every pending photo will be rejected.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="border-0 p-0">
          <legend className="sr-only">Rejection reasons</legend>
          <div className="flex flex-wrap gap-2.5">
            {REJECTION_REASONS.map((reason) => (
              <ToggleChip
                key={reason}
                pressed={selected.includes(reason)}
                onClick={() => toggle(reason)}
              >
                {reason}
              </ToggleChip>
            ))}
          </div>
        </fieldset>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={selected.length === 0 || pending}
            onClick={() => onConfirm(selected)}
          >
            <X aria-hidden />
            Reject{selected.length > 0 ? ` · ${selected.length}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
