import { requireUser } from "@/auth/guards";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UploadForm } from "@/components/upload/upload-form";

export default async function UploadPage() {
  await requireUser();
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Upload a cat</CardTitle>
          <CardDescription>
            Add a name and 1–3 photos. New cats are reviewed before they enter the arena.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UploadForm />
        </CardContent>
      </Card>
    </main>
  );
}
