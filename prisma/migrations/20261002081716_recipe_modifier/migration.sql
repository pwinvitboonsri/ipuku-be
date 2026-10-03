-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CREATE_RECIPE_MODIFIER';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_RECIPE_MODIFIER';
ALTER TYPE "AuditAction" ADD VALUE 'DELETE_RECIPE_MODIFIER';

-- CreateTable
CREATE TABLE "RecipeModifier" (
    "id" TEXT NOT NULL,
    "quantity_delta" INTEGER NOT NULL,
    "update_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "create_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "product_id" TEXT NOT NULL,
    "modifier_option_id" TEXT NOT NULL,
    "ingredient_id" TEXT NOT NULL,

    CONSTRAINT "RecipeModifier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecipeModifier_product_id_idx" ON "RecipeModifier"("product_id");

-- CreateIndex
CREATE INDEX "RecipeModifier_ingredient_id_idx" ON "RecipeModifier"("ingredient_id");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeModifier_product_id_modifier_option_id_ingredient_id_key" ON "RecipeModifier"("product_id", "modifier_option_id", "ingredient_id");

-- AddForeignKey
ALTER TABLE "RecipeModifier" ADD CONSTRAINT "RecipeModifier_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeModifier" ADD CONSTRAINT "RecipeModifier_modifier_option_id_fkey" FOREIGN KEY ("modifier_option_id") REFERENCES "ModifierOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeModifier" ADD CONSTRAINT "RecipeModifier_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
