/*
  Warnings:

  - You are about to alter the column `stock_quantity` on the `Ingredient` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.
  - You are about to alter the column `reorder_level` on the `Ingredient` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.
  - You are about to alter the column `quantity_per_unit` on the `Recipe` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.
  - You are about to alter the column `change_quantity` on the `StockMovement` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CREATE_INGREDIENT';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_INGREDIENT';
ALTER TYPE "AuditAction" ADD VALUE 'ACTIVE_INGREDIENT';
ALTER TYPE "AuditAction" ADD VALUE 'DEACTIVATE_INGREDIENT';

-- AlterTable
-- Values are scaled x100 (e.g. 25.5 -> 2550) when converting from Decimal to Integer,
-- to preserve up to 2 decimal places of precision as whole numbers.
ALTER TABLE "Ingredient" ALTER COLUMN "stock_quantity" TYPE INTEGER USING ROUND("stock_quantity" * 100)::integer,
ALTER COLUMN "reorder_level" TYPE INTEGER USING ROUND("reorder_level" * 100)::integer,
ALTER COLUMN "is_active" SET DEFAULT true;

-- AlterTable
ALTER TABLE "Recipe" ALTER COLUMN "quantity_per_unit" TYPE INTEGER USING ROUND("quantity_per_unit" * 100)::integer;

-- AlterTable
ALTER TABLE "StockMovement" ALTER COLUMN "change_quantity" TYPE INTEGER USING ROUND("change_quantity" * 100)::integer;
