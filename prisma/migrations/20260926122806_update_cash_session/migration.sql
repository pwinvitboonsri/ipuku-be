-- DropForeignKey
ALTER TABLE "CashSession" DROP CONSTRAINT "CashSession_close_by_staff_id_fkey";

-- AlterTable
ALTER TABLE "CashSession" ALTER COLUMN "close_by_staff_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_close_by_staff_id_fkey" FOREIGN KEY ("close_by_staff_id") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
