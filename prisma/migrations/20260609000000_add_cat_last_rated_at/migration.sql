-- AlterTable: track the last vote that updated a cat's rating (drives RD-decay cron)
ALTER TABLE "Cat" ADD COLUMN "lastRatedAt" TIMESTAMP(3);
