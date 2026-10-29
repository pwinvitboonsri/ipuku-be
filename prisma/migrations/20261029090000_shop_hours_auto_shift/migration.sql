-- Shop hours (weekly pattern + special days) and shifts that open/close on that schedule.
-- A system action (auto-close voiding an unpaid order) has no staff in the audit log.
-- CreateEnum
CREATE TYPE "SpecialDayKind" AS ENUM ('CLOSED', 'HOURS');

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_staff_id_fkey";

-- DropForeignKey
ALTER TABLE "CashSession" DROP CONSTRAINT "CashSession_opened_by_staff_id_fkey";

-- AlterTable
ALTER TABLE "AuditLog" ALTER COLUMN "staff_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CashSession" ADD COLUMN     "auto_closed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "auto_opened" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "opened_by_staff_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ShopSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "auto_shift" BOOLEAN NOT NULL DEFAULT false,
    "auto_close_grace_minutes" INTEGER NOT NULL DEFAULT 30,
    "default_float_satang" INTEGER NOT NULL DEFAULT 0,
    "update_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "update_by_staff_id" TEXT,

    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyHours" (
    "id" TEXT NOT NULL,
    "effective_from" TEXT NOT NULL,
    "days" JSONB NOT NULL,
    "update_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "create_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "update_by_staff_id" TEXT,

    CONSTRAINT "WeeklyHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpecialDay" (
    "id" TEXT NOT NULL,
    "kind" "SpecialDayKind" NOT NULL,
    "from_date" TEXT NOT NULL,
    "to_date" TEXT NOT NULL,
    "open_min" INTEGER,
    "close_min" INTEGER,
    "note" TEXT,
    "update_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "create_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "update_by_staff_id" TEXT,

    CONSTRAINT "SpecialDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyHours_effective_from_key" ON "WeeklyHours"("effective_from");

-- CreateIndex
CREATE INDEX "SpecialDay_from_date_to_date_idx" ON "SpecialDay"("from_date", "to_date");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_opened_by_staff_id_fkey" FOREIGN KEY ("opened_by_staff_id") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopSettings" ADD CONSTRAINT "ShopSettings_update_by_staff_id_fkey" FOREIGN KEY ("update_by_staff_id") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyHours" ADD CONSTRAINT "WeeklyHours_update_by_staff_id_fkey" FOREIGN KEY ("update_by_staff_id") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpecialDay" ADD CONSTRAINT "SpecialDay_update_by_staff_id_fkey" FOREIGN KEY ("update_by_staff_id") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

