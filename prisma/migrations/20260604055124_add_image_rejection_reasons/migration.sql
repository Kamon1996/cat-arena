-- AlterTable
ALTER TABLE "CatImage" ADD COLUMN     "rejectionReasons" TEXT[] DEFAULT ARRAY[]::TEXT[];
