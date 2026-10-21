-- CreateEnum
CREATE TYPE "PointsEntryType" AS ENUM ('EARN', 'REDEEM', 'REVERSAL');

-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('FIXED_DISCOUNT', 'FREE_ITEM');

-- CreateEnum
CREATE TYPE "RewardCodeStatus" AS ENUM ('ACTIVE', 'APPLIED', 'USED', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_LOYALTY_PROGRAM';
ALTER TYPE "AuditAction" ADD VALUE 'CREATE_REWARD';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_REWARD';
ALTER TYPE "AuditAction" ADD VALUE 'ACTIVE_REWARD';
ALTER TYPE "AuditAction" ADD VALUE 'DEACTIVATE_REWARD';

-- CreateTable
CREATE TABLE "LoyaltyProgram" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "points_per_unit" INTEGER NOT NULL DEFAULT 1,
    "unit_satang" INTEGER NOT NULL DEFAULT 1000,
    "claim_valid_hours" INTEGER NOT NULL DEFAULT 24,
    "reward_code_minutes" INTEGER NOT NULL DEFAULT 10,
    "consent_version" TEXT NOT NULL DEFAULT '2026-10-21',
    "update_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "update_by_staff_id" TEXT,

    CONSTRAINT "LoyaltyProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineContact" (
    "line_user_id" TEXT NOT NULL,
    "is_friend" BOOLEAN NOT NULL DEFAULT true,
    "followed_at" TIMESTAMP(3),
    "unfollowed_at" TIMESTAMP(3),
    "update_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "create_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LineContact_pkey" PRIMARY KEY ("line_user_id")
);

-- CreateTable
CREATE TABLE "Member" (
    "id" TEXT NOT NULL,
    "member_no" SERIAL NOT NULL,
    "line_user_id" TEXT NOT NULL,
    "display_name" TEXT,
    "picture_url" TEXT,
    "consent_version" TEXT NOT NULL,
    "consented_at" TIMESTAMP(3) NOT NULL,
    "update_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "create_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointsEntry" (
    "id" TEXT NOT NULL,
    "type" "PointsEntryType" NOT NULL,
    "points" INTEGER NOT NULL,
    "note" TEXT,
    "create_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "member_id" TEXT NOT NULL,
    "order_id" TEXT,
    "claim_token_id" TEXT,
    "reward_code_id" TEXT,
    "staff_id" TEXT,
    "reverses_id" TEXT,

    CONSTRAINT "PointsEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "total_satang" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "claimed_at" TIMESTAMP(3),
    "create_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "order_id" TEXT NOT NULL,
    "member_id" TEXT,

    CONSTRAINT "ClaimToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cost_points" INTEGER NOT NULL,
    "type" "RewardType" NOT NULL,
    "discount_satang" INTEGER,
    "max_discount_satang" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "update_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "create_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "product_id" TEXT,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "status" "RewardCodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "reward_name" TEXT NOT NULL,
    "cost_points" INTEGER NOT NULL,
    "discount_satang" INTEGER,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "applied_at" TIMESTAMP(3),
    "used_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "update_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "create_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "member_id" TEXT NOT NULL,
    "reward_id" TEXT NOT NULL,
    "order_id" TEXT,

    CONSTRAINT "RewardCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineWebhookEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "create_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LineWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_member_no_key" ON "Member"("member_no");

-- CreateIndex
CREATE UNIQUE INDEX "Member_line_user_id_key" ON "Member"("line_user_id");

-- CreateIndex
CREATE INDEX "Member_display_name_idx" ON "Member"("display_name");

-- CreateIndex
CREATE UNIQUE INDEX "PointsEntry_claim_token_id_key" ON "PointsEntry"("claim_token_id");

-- CreateIndex
CREATE UNIQUE INDEX "PointsEntry_reward_code_id_key" ON "PointsEntry"("reward_code_id");

-- CreateIndex
CREATE UNIQUE INDEX "PointsEntry_reverses_id_key" ON "PointsEntry"("reverses_id");

-- CreateIndex
CREATE INDEX "PointsEntry_member_id_create_at_idx" ON "PointsEntry"("member_id", "create_at");

-- CreateIndex
CREATE INDEX "PointsEntry_order_id_idx" ON "PointsEntry"("order_id");

-- CreateIndex
CREATE INDEX "PointsEntry_type_create_at_idx" ON "PointsEntry"("type", "create_at");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimToken_token_key" ON "ClaimToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimToken_code_key" ON "ClaimToken"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ClaimToken_order_id_key" ON "ClaimToken"("order_id");

-- CreateIndex
CREATE INDEX "ClaimToken_expires_at_idx" ON "ClaimToken"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "RewardCode_code_key" ON "RewardCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "RewardCode_order_id_key" ON "RewardCode"("order_id");

-- CreateIndex
CREATE INDEX "RewardCode_member_id_status_idx" ON "RewardCode"("member_id", "status");

-- CreateIndex
CREATE INDEX "LineWebhookEvent_create_at_idx" ON "LineWebhookEvent"("create_at");

-- AddForeignKey
ALTER TABLE "LoyaltyProgram" ADD CONSTRAINT "LoyaltyProgram_update_by_staff_id_fkey" FOREIGN KEY ("update_by_staff_id") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsEntry" ADD CONSTRAINT "PointsEntry_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsEntry" ADD CONSTRAINT "PointsEntry_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsEntry" ADD CONSTRAINT "PointsEntry_claim_token_id_fkey" FOREIGN KEY ("claim_token_id") REFERENCES "ClaimToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsEntry" ADD CONSTRAINT "PointsEntry_reward_code_id_fkey" FOREIGN KEY ("reward_code_id") REFERENCES "RewardCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsEntry" ADD CONSTRAINT "PointsEntry_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointsEntry" ADD CONSTRAINT "PointsEntry_reverses_id_fkey" FOREIGN KEY ("reverses_id") REFERENCES "PointsEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimToken" ADD CONSTRAINT "ClaimToken_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimToken" ADD CONSTRAINT "ClaimToken_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardCode" ADD CONSTRAINT "RewardCode_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardCode" ADD CONSTRAINT "RewardCode_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "Reward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardCode" ADD CONSTRAINT "RewardCode_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
