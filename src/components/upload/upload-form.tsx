"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { catToast } from "@/components/ui/cat-toast";
import { Input } from "@/components/ui/input";
import { ImageDropzone } from "@/components/upload/image-dropzone";
import { useEagerUploads } from "@/components/upload/use-eager-uploads";
import { ALLOWED_UPLOAD_TYPES, MAX_IMAGES_PER_CAT, MAX_UPLOAD_BYTES } from "@/lib/constants";

const MIN_NAME = 1;
const MAX_NAME = 60;

const CropRectSchema = z.object({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const FormSchema = z.object({
  name: z.string().trim().min(MIN_NAME).max(MAX_NAME),
  files: z
    .array(
      z.object({
        id: z.string().min(1),
        file: z.instanceof(File),
        crop: CropRectSchema.nullable(),
      }),
    )
    .min(1, "Add at least one photo")
    .max(MAX_IMAGES_PER_CAT)
    .refine(
      (photos) =>
        photos.every(
          (p) =>
            (ALLOWED_UPLOAD_TYPES as readonly string[]).includes(p.file.type) &&
            p.file.size <= MAX_UPLOAD_BYTES,
        ),
      "Only JPEG/PNG/WebP up to 10MB",
    ),
});

type UploadFormValues = z.infer<typeof FormSchema>;

type CreateCatResponse = {
  slug: string;
  status: string;
  screens?: Array<{ status: string; catConfidence: number }>;
};

export function UploadForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { entries, sync, retry, waitAll } = useEagerUploads();

  const {
    handleSubmit,
    register,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UploadFormValues>({
    resolver: zodResolver(FormSchema),
    mode: "onBlur",
    defaultValues: { name: "", files: [] },
  });

  const files = watch("files");

  // Eager uploads: every photo starts its hash → sign → PUT the moment it
  // joins the list, and an in-flight upload is aborted when its photo is
  // removed. By submit time the bytes are usually already in R2.
  useEffect(() => {
    sync(files);
  }, [files, sync]);

  const uploadedCount = files.filter((p) => entries[p.id]?.status === "uploaded").length;
  const uploadsInFlight = files.some(
    (p) => entries[p.id]?.status === "hashing" || entries[p.id]?.status === "uploading",
  );

  async function onSubmit(values: UploadFormValues): Promise<void> {
    setSubmitError(null);
    try {
      // The bytes are (usually) already in R2 — wait for any stragglers and
      // collect the keys. Failures stay on their tiles with a Retry button.
      const uploads = await waitAll(values.files.map((p) => p.id));
      if (!uploads.ok) {
        setSubmitError("Some photos failed to upload — retry or remove them.");
        return;
      }
      const res = await fetch("/api/cats", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          images: values.files.map((p) => ({
            r2Key: uploads.keys[p.id],
            ...(p.crop ? { crop: p.crop } : {}),
          })),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not create cat");
      }
      const { slug, status, screens } = (await res.json()) as CreateCatResponse;
      // Surface the auto-screen result in the browser console (logs only, no UI).
      for (const [i, s] of (screens ?? []).entries()) {
        console.log(
          `[screen-image] photo ${i + 1}: cat=${(s.catConfidence * 100).toFixed(1)}% → ${s.status}`,
        );
      }
      // Honest outcome, not an optimistic one: the toast matches what really
      // happened. Both fire here but render on the destination page — the
      // Toaster lives in the root layout, so they survive the navigation.
      if (status === "ACTIVE") {
        catToast.success("Your cat's in the arena!", {
          variant: "mascot",
          message: "The duels begin — watch the leaderboard.",
        });
        router.push(`/cat/${slug}`);
      } else {
        catToast.success("Almost there — photos are in review", {
          message: "Your cat joins the arena as soon as a photo is approved.",
        });
        // A PENDING cat has no public page yet — its home is the dashboard.
        router.push("/dashboard");
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  const submitLabel = isSubmitting
    ? uploadsInFlight
      ? `Uploading photos ${uploadedCount}/${files.length}…`
      : "Publishing…"
    : "Create cat";

  return (
    <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
      <div className="flex flex-col gap-2">
        <label htmlFor="cat-name" className="font-medium text-sm">
          Cat name
        </label>
        <Input
          id="cat-name"
          placeholder="e.g. Mittens"
          aria-invalid={Boolean(errors.name)}
          {...register("name")}
        />
        {errors.name ? (
          <p className="text-destructive text-sm" role="alert">
            {errors.name.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-medium text-sm">Photos</span>
        <ImageDropzone
          files={files}
          onChange={(next) => setValue("files", next, { shouldValidate: true })}
          disabled={isSubmitting}
          uploads={entries}
          onRetryUpload={retry}
        />
        {errors.files ? (
          <p className="text-destructive text-sm" role="alert">
            {errors.files.message as string}
          </p>
        ) : null}
      </div>

      {submitError ? (
        <p className="text-destructive text-sm" role="alert">
          {submitError}
        </p>
      ) : null}

      <Button type="submit" className="self-start" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" /> : <Plus />}
        {submitLabel}
      </Button>
    </form>
  );
}
