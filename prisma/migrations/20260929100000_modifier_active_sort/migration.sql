-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CREATE_MODIFIER_GROUP';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_MODIFIER_GROUP';
ALTER TYPE "AuditAction" ADD VALUE 'ACTIVE_MODIFIER_GROUP';
ALTER TYPE "AuditAction" ADD VALUE 'DEACTIVATE_MODIFIER_GROUP';
ALTER TYPE "AuditAction" ADD VALUE 'CREATE_MODIFIER_OPTION';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_MODIFIER_OPTION';
ALTER TYPE "AuditAction" ADD VALUE 'ACTIVE_MODIFIER_OPTION';
ALTER TYPE "AuditAction" ADD VALUE 'DEACTIVATE_MODIFIER_OPTION';
ALTER TYPE "AuditAction" ADD VALUE 'ATTACH_MODIFIER_GROUP';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_PRODUCT_MODIFIER_GROUP';
ALTER TYPE "AuditAction" ADD VALUE 'DETACH_MODIFIER_GROUP';

-- AlterTable
ALTER TABLE "ModifierGroup" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ModifierOption" ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ProductModifierGroup" ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "ModifierOption_group_id_idx" ON "ModifierOption"("group_id");

-- CreateIndex
CREATE INDEX "ProductModifierGroup_modifier_group_id_idx" ON "ProductModifierGroup"("modifier_group_id");

