import { requireUser } from "@/auth/guards";
import { UploadForm } from "@/components/upload/upload-form";

export default async function UploadPage() {
  await requireUser();
  return (
    <main>
      <h1>Upload a cat</h1>
      <UploadForm />
    </main>
  );
}
