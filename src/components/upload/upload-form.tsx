"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImageDropzone } from "@/components/upload/image-dropzone";
import { uploadToR2 } from "@/components/upload/upload-to-r2";
import { ALLOWED_UPLOAD_TYPES, MAX_IMAGES_PER_CAT, MAX_UPLOAD_BYTES } from "@/lib/constants";

const MIN_NAME = 1;
const MAX_NAME = 60;

const FormSchema = z.object({
  name: z.string().trim().min(MIN_NAME).max(MAX_NAME),
  files: z
    .array(z.instanceof(File))
    .min(1, "Add at least one photo")
    .max(MAX_IMAGES_PER_CAT)
    .refine(
      (fs) =>
        fs.every(
          (f) =>
            (ALLOWED_UPLOAD_TYPES as readonly string[]).includes(f.type) &&
            f.size <= MAX_UPLOAD_BYTES,
        ),
      "Only JPEG/PNG/WebP up to 10MB",
    ),
});

type UploadFormValues = z.infer<typeof FormSchema>;

export function UploadForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  async function onSubmit(values: UploadFormValues): Promise<void> {
    setSubmitError(null);
    try {
      const uploaded = await Promise.all(values.files.map(uploadToR2));
      const res = await fetch("/api/cats", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          images: uploaded.map((u) => ({ r2Key: u.r2Key })),
        }),
      });
      if (!res.ok) {
        throw new Error("Could not create cat");
      }
      const { slug } = (await res.json()) as { slug: string };
      router.push(`/cat/${slug}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

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
        {isSubmitting ? "Uploading…" : "Create cat"}
      </Button>
    </form>
  );
}
