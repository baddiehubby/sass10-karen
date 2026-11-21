-- Karen Accountability Loop — optional Prisma mirror of localStorage goals.
-- Safe / idempotent for Neon.

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "karenAccountabilityJson" TEXT;
