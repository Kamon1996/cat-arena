import { Cat } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <Cat className="size-12 text-muted-foreground" />
      <h1 className="font-bold text-3xl tracking-tight">404</h1>
      <p className="text-muted-foreground">This page wandered off like a curious cat.</p>
      <Button asChild className="mt-2">
        <Link href="/">Back to the arena</Link>
      </Button>
    </main>
  );
}
