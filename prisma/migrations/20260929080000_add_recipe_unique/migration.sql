-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CREATE_RECIPE';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_RECIPE';
ALTER TYPE "AuditAction" ADD VALUE 'DELETE_RECIPE';

-- CreateIndex
CREATE INDEX "Recipe_ingredient_id_idx" ON "Recipe"("ingredient_id");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_product_id_ingredient_id_key" ON "Recipe"("product_id", "ingredient_id");

