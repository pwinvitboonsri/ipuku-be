/*
  Warnings:

  - You are about to drop the column `oder_id` on the `StockMovement` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "StockMovement" DROP CONSTRAINT "StockMovement_oder_id_fkey";

-- AlterTable
ALTER TABLE "StockMovement" DROP COLUMN "oder_id",
ADD COLUMN     "order_id" TEXT;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
