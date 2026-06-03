"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ORG_DESCRIPTION_MAX,
  ORG_NAME_MAX,
  ORG_NAME_MIN,
} from "@/lib/constants";
import type { CreateOrgResponse } from "@/lib/org-api-types";

const orgFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(ORG_NAME_MIN, `Name must be at least ${ORG_NAME_MIN} characters`)
    .max(ORG_NAME_MAX, `Name cannot exceed ${ORG_NAME_MAX} characters`),
  description: z
    .string()
    .trim()
    .max(
      ORG_DESCRIPTION_MAX,
      `Description cannot exceed ${ORG_DESCRIPTION_MAX} characters`,
    )
    .optional(),
});

type OrgFormValues = z.infer<typeof orgFormSchema>;

const TEXTAREA_CLASS =
  "flex min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30";

export function OrgCreateForm() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OrgFormValues>({
    resolver: zodResolver(orgFormSchema),
    mode: "onBlur",
    defaultValues: { name: "", description: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    const res = await fetch("/api/orgs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: values.name,
        description: values.description || undefined,
      }),
    });
    if (!res.ok) {
      setSubmitError("Could not create organization. The name may be taken.");
      return;
    }
    const org = (await res.json()) as CreateOrgResponse;
    router.push(`/org/${org.slug}`);
  });

  return (
    <form onSubmit={onSubmit} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="org-name" className="font-medium text-sm">
          Name
        </label>
        <Input
          id="org-name"
          type="text"
          autoComplete="off"
          aria-invalid={errors.name ? true : undefined}
          {...register("name")}
        />
        {errors.name ? (
          <span role="alert" className="text-destructive text-sm">
            {errors.name.message}
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="org-description" className="font-medium text-sm">
          Description{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="org-description"
          rows={3}
          className={TEXTAREA_CLASS}
          aria-invalid={errors.description ? true : undefined}
          {...register("description")}
        />
        {errors.description ? (
          <span role="alert" className="text-destructive text-sm">
            {errors.description.message}
          </span>
        ) : null}
      </div>

      {submitError ? (
        <p role="alert" className="text-destructive text-sm">
          {submitError}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting}>
        Create organization
      </Button>
    </form>
  );
}
