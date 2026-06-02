import { ImageStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Glicko-2 defaults applied through SCORE: 1500 - 2*350 = 800
// (mirrors src/lib/constants.ts GLICKO_DEFAULT + SCORE; the seed is standalone
//  and must not import app code, so the literals are local named constants here)
const SEED_RATING = 1500;
const SEED_RD = 350;
const SEED_VOL = 0.06;
const SEED_SCORE = SEED_RATING - 2 * SEED_RD;

const ADMIN_EMAIL = "admin@cat-arena.local";

type SeedCat = {
  id: string;
  slug: string;
  name: string;
  r2Key: string;
};

const SEED_CATS: SeedCat[] = [
  { id: "seed-cat-mittens", slug: "mittens-seed01", name: "Mittens", r2Key: "seed/mittens.webp" },
  { id: "seed-cat-shadow", slug: "shadow-seed02", name: "Shadow", r2Key: "seed/shadow.webp" },
];

const SEED_IMAGE_WIDTH = 800;
const SEED_IMAGE_HEIGHT = 800;

async function main(): Promise<void> {
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: "ADMIN" },
    create: { email: ADMIN_EMAIL, name: "Seed Admin", role: "ADMIN" },
  });

  for (const seed of SEED_CATS) {
    await prisma.cat.upsert({
      where: { id: seed.id },
      update: {},
      create: {
        id: seed.id,
        slug: seed.slug,
        name: seed.name,
        ownerId: admin.id,
        status: "ACTIVE",
        approvedAt: new Date(),
        rating: SEED_RATING,
        rd: SEED_RD,
        vol: SEED_VOL,
        score: SEED_SCORE,
        images: {
          create: [
            {
              r2Key: seed.r2Key,
              width: SEED_IMAGE_WIDTH,
              height: SEED_IMAGE_HEIGHT,
              position: 0,
              status: ImageStatus.APPROVED,
            },
          ],
        },
      },
    });
  }

  const catCount = await prisma.cat.count({ where: { status: "ACTIVE" } });
  console.log(`Seed complete: ${catCount} ACTIVE cats, admin ${admin.email}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
