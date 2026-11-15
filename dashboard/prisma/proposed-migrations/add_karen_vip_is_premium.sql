-- PROPOSED ONLY. Additive Karen VIP columns on User.
-- Free quota: karenChatCount messages on karenChatDay (UTC), cap 3/day.
-- Do not apply to production until reviewed.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "isPremium" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "lemonSqueezyCustomerId" TEXT;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "karenChatCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "karenChatDay" TEXT;

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "karenCustomerPortalUrl" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'User_lemonSqueezyCustomerId_key'
  ) THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_lemonSqueezyCustomerId_key" UNIQUE ("lemonSqueezyCustomerId");
  END IF;
END $$;
