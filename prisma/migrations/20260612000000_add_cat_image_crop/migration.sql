-- AlterTable: the duel-framing crop rect actually applied to thumb/card,
-- {x,y,width,height} in pixels of the rotation-baked original. Nullable:
-- NULL = uncropped (and all legacy rows, whose originals are pre-cropped).
ALTER TABLE "CatImage" ADD COLUMN "crop" JSONB;
