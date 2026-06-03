"use client";

import { ImagePlus, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { addCatImage } from "@/cats/owner-actions";
import { Button } from "@/components/ui/button";
import { ImageDropzone } from "@/components/upload/image-dropzone";
import { uploadToR2 } from "@/components/upload/upload-to-r2";

type AddImageProps = {
  catId: string;
  remaining: number;
  disabled?: boolean;
};

export function AddImage({ catId, remaining, disabled }: AddImageProps) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  if (remaining <= 0) {
    return <p className="text-muted-foreground text-sm">Maximum images reached.</p>;
  }

  async function submit(): Promise<void> {
    if (files.length === 0 || busy) {
      return;
    }
    setBusy(true);
    try {
      for (const file of files.slice(0, remaining)) {
        const { r2Key } = await uploadToR2(file);
        const result = await addCatImage(catId, r2Key);
        if (!result.ok) {
          throw new Error(result.error);
        }
      }
      toast.success("Image added — pending review");
      setFiles([]);
      router.refresh();
    } catch (err) {
      toast.error(`Could not add image${err instanceof Error ? ` (${err.message})` : ""}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <ImageDropzone files={files} onChange={setFiles} disabled={disabled || busy} />
      <Button
        type="button"
        size="sm"
        className="self-start"
        onClick={() => void submit()}
        disabled={disabled || busy || files.length === 0}
      >
        {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />}
        {busy ? "Uploading…" : "Add image"}
      </Button>
    </div>
  );
}
