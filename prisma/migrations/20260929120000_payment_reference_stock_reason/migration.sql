-- CreateEnum
CREATE TYPE "StockMovementReason" AS ENUM ('SALE', 'RESTOCK', 'WASTE', 'COUNT_CORRECTION');

-- AlterTable: convert reason in place (keeps data, unlike DROP + ADD)
ALTER TABLE "StockMovement" ALTER COLUMN "reason" TYPE "StockMovementReason" USING "reason"::"StockMovementReason";
ALTER TABLE "StockMovement" ADD COLUMN "note" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "reference" TEXT;

-- CreateIndex
CREATE INDEX "Payment_order_id_idx" ON "Payment"("order_id");

-- CreateIndex
CREATE INDEX "StockMovement_ingredient_id_create_at_idx" ON "StockMovement"("ingredient_id", "create_at");

-- CreateIndex
CREATE INDEX "StockMovement_order_id_idx" ON "StockMovement"("order_id");
