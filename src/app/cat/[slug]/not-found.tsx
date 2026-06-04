import Link from "next/link";

export default function CatNotFound() {
  return (
    <main className="mx-auto max-w-xl p-8 text-center">
      <h1 className="font-display font-bold text-2xl">Cat not found</h1>
      <p className="mt-2 text-muted-foreground">It may still be under review, or it was hidden.</p>
      <Link href="/top" className="mt-4 inline-block font-semibold underline">
        See the top cats
      </Link>
    </main>
  );
}
