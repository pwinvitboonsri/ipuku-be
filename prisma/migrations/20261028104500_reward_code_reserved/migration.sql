-- A reward scanned at the counter before its order exists: held until this time
ALTER TABLE "RewardCode" ADD COLUMN "reserved_until" TIMESTAMP(3);
