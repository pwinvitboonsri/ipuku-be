-- CreateEnum
CREATE TYPE "OrderChannel" AS ENUM ('WALK_IN', 'GRAB');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'GRAB_ORDER_RECEIVED';
ALTER TYPE "AuditAction" ADD VALUE 'GRAB_ORDER_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE 'GRAB_ORDER_CANCELLED';
ALTER TYPE "AuditAction" ADD VALUE 'GRAB_ORDER_ACKNOWLEDGED';

-- AlterEnum
ALTER TYPE "PaymentType" ADD VALUE 'GRAB';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "channel" "OrderChannel" NOT NULL DEFAULT 'WALK_IN';

-- CreateTable
CREATE TABLE "GrabOrder" (
    "id" TEXT NOT NULL,
    "grab_order_id" TEXT NOT NULL,
    "short_order_number" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "grab_subtotal_satang" INTEGER NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "rejected_reason" TEXT,
    "acknowledged_at" TIMESTAMP(3),
    "update_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "create_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "order_id" TEXT,
    "acknowledged_by_staff_id" TEXT,

    CONSTRAINT "GrabOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT,
    "last_success_at" TIMESTAMP(3),
    "update_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "create_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staff_id" TEXT NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GrabOrder_grab_order_id_key" ON "GrabOrder"("grab_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "GrabOrder_order_id_key" ON "GrabOrder"("order_id");

-- CreateIndex
CREATE INDEX "GrabOrder_acknowledged_at_idx" ON "GrabOrder"("acknowledged_at");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_staff_id_idx" ON "PushSubscription"("staff_id");

-- CreateIndex
CREATE INDEX "Order_channel_idx" ON "Order"("channel");

-- AddForeignKey
ALTER TABLE "GrabOrder" ADD CONSTRAINT "GrabOrder_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrabOrder" ADD CONSTRAINT "GrabOrder_acknowledged_by_staff_id_fkey" FOREIGN KEY ("acknowledged_by_staff_id") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
