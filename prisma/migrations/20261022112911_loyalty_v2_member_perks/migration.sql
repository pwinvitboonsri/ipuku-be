-- CreateEnum
CREATE TYPE "LoyaltyCurrency" AS ENUM ('POINTS', 'STAMPS');

-- CreateEnum
CREATE TYPE "EarnRuleKind" AS ENUM ('STAMPS_PER_VISIT', 'MULTIPLIER', 'BONUS');

-- CreateEnum
CREATE TYPE "PerkKind" AS ENUM ('WELCOME', 'BIRTHDAY');

-- CreateEnum
CREATE TYPE "WelcomeTrigger" AS ENUM ('JOIN', 'FIRST_CLAIM');

-- CreateEnum
CREATE TYPE "CouponSource" AS ENUM ('WELCOME', 'BIRTHDAY', 'MANUAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'CREATE_EARN_RULE';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_EARN_RULE';
ALTER TYPE "AuditAction" ADD VALUE 'ACTIVE_EARN_RULE';
ALTER TYPE "AuditAction" ADD VALUE 'DEACTIVATE_EARN_RULE';
ALTER TYPE "AuditAction" ADD VALUE 'UPDATE_LOYALTY_PERK';
ALTER TYPE "AuditAction" ADD VALUE 'ADJUST_POINTS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PointsEntryType" ADD VALUE 'BONUS';
ALTER TYPE "PointsEntryType" ADD VALUE 'ADJUST';
ALTER TYPE "PointsEntryType" ADD VALUE 'EXPIRE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RewardType" ADD VALUE 'PERCENT_OFF';
ALTER TYPE "RewardType" ADD VALUE 'FREE_OPTION';
ALTER TYPE "RewardType" ADD VALUE 'BUY_X_GET_Y';

-- DropIndex
DROP INDEX "PointsEntry_claim_token_id_key";

-- DropIndex
DROP INDEX "PointsEntry_member_id_create_at_idx";

-- AlterTable
ALTER TABLE "ClaimToken" ADD COLUMN     "lines" JSONB,
ADD COLUMN     "stamps" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "birth_day" INTEGER,
ADD COLUMN     "birth_month" INTEGER;

-- AlterTable
ALTER TABLE "PointsEntry" ADD COLUMN     "currency" "LoyaltyCurrency" NOT NULL DEFAULT 'POINTS';

-- AlterTable
ALTER TABLE "Reward" ADD COLUMN     "buy_qty" INTEGER,
ADD COLUMN     "category_ids" TEXT[],
ADD COLUMN     "combine_with_promotions" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cost_currency" "LoyaltyCurrency" NOT NULL DEFAULT 'POINTS',
ADD COLUMN     "ends_at" TIMESTAMP(3),
ADD COLUMN     "get_percent" INTEGER,
ADD COLUMN     "get_qty" INTEGER,
ADD COLUMN     "min_spend_satang" INTEGER,
ADD COLUMN     "option_ids" TEXT[],
ADD COLUMN     "percent" INTEGER,
ADD COLUMN     "product_ids" TEXT[],
ADD COLUMN     "starts_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "RewardCode" ADD COLUMN     "cost_currency" "LoyaltyCurrency" NOT NULL DEFAULT 'POINTS',
ADD COLUMN     "coupon_id" TEXT;

-- CreateTable
CREATE TABLE "EarnRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "EarnRuleKind" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "currency" "LoyaltyCurrency" NOT NULL DEFAULT 'POINTS',
    "multiplier_x10" INTEGER NOT NULL DEFAULT 10,
    "per_item" BOOLEAN NOT NULL DEFAULT false,
    "min_spend_satang" INTEGER NOT NULL DEFAULT 0,
    "min_items" INTEGER NOT NULL DEFAULT 0,
    "product_ids" TEXT[],
    "category_ids" TEXT[],
    "weekdays" INTEGER[],
    "time_from" INTEGER,
    "time_to" INTEGER,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "stackable" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "update_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "create_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EarnRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoyaltyPerk" (
    "kind" "PerkKind" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "trigger" "WelcomeTrigger" NOT NULL DEFAULT 'JOIN',
    "grant_points" INTEGER NOT NULL DEFAULT 0,
    "grant_stamps" INTEGER NOT NULL DEFAULT 0,
    "coupon_valid_days" INTEGER NOT NULL DEFAULT 30,
    "send_message" BOOLEAN NOT NULL DEFAULT true,
    "update_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reward_id" TEXT,

    CONSTRAINT "LoyaltyPerk_pkey" PRIMARY KEY ("kind")
);

-- CreateTable
CREATE TABLE "MemberCoupon" (
    "id" TEXT NOT NULL,
    "source" "CouponSource" NOT NULL,
    "note" TEXT,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "create_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "member_id" TEXT NOT NULL,
    "reward_id" TEXT NOT NULL,

    CONSTRAINT "MemberCoupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PerkGrant" (
    "id" TEXT NOT NULL,
    "kind" "PerkKind" NOT NULL,
    "period" TEXT NOT NULL,
    "create_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "member_id" TEXT NOT NULL,

    CONSTRAINT "PerkGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberCoupon_member_id_used_at_idx" ON "MemberCoupon"("member_id", "used_at");

-- CreateIndex
CREATE UNIQUE INDEX "PerkGrant_member_id_kind_period_key" ON "PerkGrant"("member_id", "kind", "period");

-- CreateIndex
CREATE INDEX "PointsEntry_member_id_currency_create_at_idx" ON "PointsEntry"("member_id", "currency", "create_at");

-- CreateIndex
CREATE INDEX "PointsEntry_claim_token_id_idx" ON "PointsEntry"("claim_token_id");

-- CreateIndex
CREATE UNIQUE INDEX "RewardCode_coupon_id_key" ON "RewardCode"("coupon_id");

-- AddForeignKey
ALTER TABLE "RewardCode" ADD CONSTRAINT "RewardCode_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "MemberCoupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoyaltyPerk" ADD CONSTRAINT "LoyaltyPerk_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "Reward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberCoupon" ADD CONSTRAINT "MemberCoupon_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberCoupon" ADD CONSTRAINT "MemberCoupon_reward_id_fkey" FOREIGN KEY ("reward_id") REFERENCES "Reward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerkGrant" ADD CONSTRAINT "PerkGrant_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

