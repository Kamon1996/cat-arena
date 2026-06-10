-- AlterTable: SHA-256 of the original upload bytes, for duplicate detection.
-- Nullable so legacy rows need no backfill; Postgres unique indexes allow many NULLs.
ALTER TABLE "CatImage" ADD COLUMN "sha256" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CatImage_sha256_key" ON "CatImage"("sha256");
