import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { OrgFeed } from "@/components/org/org-feed";
import { OrgLeaderboard, type OrgLeaderboardRow } from "@/components/org/org-leaderboard";
import { ORG_MIN_INDEXABLE_MEMBERS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type OrgPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata(props: OrgPageProps): Promise<Metadata> {
  const { slug } = await props.params;
  const org = await prisma.organization.findUnique({
    where: { slug },
    select: {
      name: true,
      description: true,
      _count: { select: { members: true } },
    },
  });

  if (!org) {
    return { title: "Organization not found" };
  }

  const indexable = org._count.members >= ORG_MIN_INDEXABLE_MEMBERS;
  return {
    title: `${org.name} — cat leaderboard`,
    description: org.description ?? `The ${org.name} private cat-rating leaderboard.`,
    robots: { index: indexable, follow: indexable },
  };
}

export default async function OrgPage(props: OrgPageProps) {
  const { slug } = await props.params;
  const org = await prisma.organization.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      description: true,
      members: {
        orderBy: { score: "desc" },
        select: {
          catId: true,
          score: true,
          wins: true,
          losses: true,
          cat: { select: { name: true, slug: true } },
        },
      },
    },
  });

  if (!org) {
    notFound();
  }

  const rows: OrgLeaderboardRow[] = org.members.map((member) => ({
    catId: member.catId,
    name: member.cat.name,
    slug: member.cat.slug,
    score: member.score,
    wins: member.wins,
    losses: member.losses,
  }));

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const canVote = userId
    ? (await prisma.catOrg.count({
        where: { orgId: org.id, cat: { ownerId: userId } },
      })) > 0
    : false;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-bold text-3xl tracking-tight">{org.name}</h1>
        {org.description ? <p className="text-muted-foreground">{org.description}</p> : null}
      </header>

      <section aria-label="Organization duel" className="flex flex-col gap-4">
        <h2 className="font-semibold text-xl">Vote</h2>
        <OrgFeed orgId={org.id} canVote={canVote} />
      </section>

      <section aria-label="Organization leaderboard" className="flex flex-col gap-4">
        <h2 className="font-semibold text-xl">Leaderboard</h2>
        <OrgLeaderboard rows={rows} />
      </section>
    </main>
  );
}
