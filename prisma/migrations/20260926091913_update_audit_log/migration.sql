/*
  Warnings:

  - The values [DELETE_CATEGORY,DELETE_PRODUCT] on the enum `AuditAction` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AuditAction_new" AS ENUM ('LOGIN', 'LOGOUT', 'CREATE_STAFF', 'UPDATE_STAFF', 'ACTIVATE_STAFF', 'DEACTIVATE_STAFF', 'CREATE_CATEGORY', 'UPDATE_CATEGORY', 'ACTIVE_CATEGORY', 'DEACTIVATE_CATEGORY', 'CREATE_PRODUCT', 'UPDATE_PRODUCT', 'ACTIVE_PRODUCT', 'DEACTIVATE_PRODUCT', 'CREATE_ORDER', 'PAY_ORDER', 'VOID_ORDER', 'REFUND_ORDER', 'OPEN_CASH_SESSION', 'CLOSE_CASH_SESSION', 'STOCK_ADJUSTMENT');
ALTER TABLE "AuditLog" ALTER COLUMN "action" TYPE "AuditAction_new" USING ("action"::text::"AuditAction_new");
ALTER TYPE "AuditAction" RENAME TO "AuditAction_old";
ALTER TYPE "AuditAction_new" RENAME TO "AuditAction";
DROP TYPE "public"."AuditAction_old";
COMMIT;
