"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ImageDropzone } from "@/components/upload/image-dropzone";
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

type SignResponse = { uploadUrl: string; r2Key: string };

async function uploadOne(file: File): Promise<{ r2Key: string }> {
  const signRes = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentType: file.type, size: file.size }),
  });
  if (!signRes.ok) {
    throw new Error("Could not get upload URL");
  }
  const { uploadUrl, r2Key } = (await signRes.json()) as SignResponse;

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": file.type },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error("Upload failed");
  }

  return { r2Key };
}

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
      const uploaded = await Promise.all(values.files.map(uploadOne));
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
    <form onSubmit={handleSubmit(onSubmit)}>
      <label htmlFor="cat-name">Cat name</label>
      <input id="cat-name" {...register("name")} />
      {errors.name ? <span role="alert">{errors.name.message}</span> : null}

      <ImageDropzone
        files={files}
        onChange={(next) => setValue("files", next, { shouldValidate: true })}
        disabled={isSubmitting}
      />
      {errors.files ? <span role="alert">{errors.files.message as string}</span> : null}

      {submitError ? <p role="alert">{submitError}</p> : null}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Uploading…" : "Create cat"}
      </button>
    </form>
  );
}
