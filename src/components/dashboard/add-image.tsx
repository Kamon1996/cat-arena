"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { addCatImage } from "@/cats/owner-actions";
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
    return <p>Max images reached.</p>;
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
      toast.success("Image added (pending review)");
      setFiles([]);
      router.refresh();
    } catch (err) {
      toast.error(`Could not add image${err instanceof Error ? ` (${err.message})` : ""}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <ImageDropzone files={files} onChange={setFiles} disabled={disabled || busy} />
      <button type="button" onClick={() => void submit()} disabled={disabled || busy}>
        {busy ? "Uploading…" : "Add image"}
      </button>
    </div>
  );
}
