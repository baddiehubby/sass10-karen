-- Additive Stage 2A native-auth lifecycle storage.
-- Review and apply through the production database process; this repository
-- does not use this directory as an automatically deployable Prisma migration.

CREATE TABLE "MobileDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyThumbprint" TEXT NOT NULL,
    "publicKeySpki" TEXT NOT NULL,
    "platform" TEXT,
    "displayName" TEXT,
    "appVersion" TEXT,
    "revokedAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MobileDevice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MobileAuthorizationCode" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MobileAuthorizationCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MobileRefreshToken" (
    "id" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "licenseId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "credentialVersion" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "rotatedAt" TIMESTAMP(3),
    "replacedByTokenId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MobileRefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MobileProofNonce" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "nonceHash" TEXT NOT NULL,
    "proofTime" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MobileProofNonce_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MobileDevice_keyThumbprint_key"
    ON "MobileDevice"("keyThumbprint");
CREATE INDEX "MobileDevice_userId_revokedAt_idx"
    ON "MobileDevice"("userId", "revokedAt");

CREATE UNIQUE INDEX "MobileAuthorizationCode_jti_key"
    ON "MobileAuthorizationCode"("jti");
CREATE UNIQUE INDEX "MobileAuthorizationCode_codeHash_key"
    ON "MobileAuthorizationCode"("codeHash");
CREATE INDEX "MobileAuthorizationCode_deviceId_expiresAt_idx"
    ON "MobileAuthorizationCode"("deviceId", "expiresAt");
CREATE INDEX "MobileAuthorizationCode_userId_consumedAt_idx"
    ON "MobileAuthorizationCode"("userId", "consumedAt");

CREATE UNIQUE INDEX "MobileRefreshToken_jti_key"
    ON "MobileRefreshToken"("jti");
CREATE UNIQUE INDEX "MobileRefreshToken_tokenHash_key"
    ON "MobileRefreshToken"("tokenHash");
CREATE UNIQUE INDEX "MobileRefreshToken_replacedByTokenId_key"
    ON "MobileRefreshToken"("replacedByTokenId");
CREATE INDEX "MobileRefreshToken_familyId_revokedAt_idx"
    ON "MobileRefreshToken"("familyId", "revokedAt");
CREATE INDEX "MobileRefreshToken_deviceId_revokedAt_idx"
    ON "MobileRefreshToken"("deviceId", "revokedAt");
CREATE INDEX "MobileRefreshToken_userId_revokedAt_idx"
    ON "MobileRefreshToken"("userId", "revokedAt");

CREATE UNIQUE INDEX "MobileProofNonce_deviceId_purpose_nonceHash_key"
    ON "MobileProofNonce"("deviceId", "purpose", "nonceHash");
CREATE INDEX "MobileProofNonce_expiresAt_idx"
    ON "MobileProofNonce"("expiresAt");

ALTER TABLE "MobileDevice"
    ADD CONSTRAINT "MobileDevice_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MobileAuthorizationCode"
    ADD CONSTRAINT "MobileAuthorizationCode_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MobileAuthorizationCode"
    ADD CONSTRAINT "MobileAuthorizationCode_licenseId_fkey"
    FOREIGN KEY ("licenseId") REFERENCES "License"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MobileAuthorizationCode"
    ADD CONSTRAINT "MobileAuthorizationCode_deviceId_fkey"
    FOREIGN KEY ("deviceId") REFERENCES "MobileDevice"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MobileRefreshToken"
    ADD CONSTRAINT "MobileRefreshToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MobileRefreshToken"
    ADD CONSTRAINT "MobileRefreshToken_licenseId_fkey"
    FOREIGN KEY ("licenseId") REFERENCES "License"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MobileRefreshToken"
    ADD CONSTRAINT "MobileRefreshToken_deviceId_fkey"
    FOREIGN KEY ("deviceId") REFERENCES "MobileDevice"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MobileRefreshToken"
    ADD CONSTRAINT "MobileRefreshToken_replacedByTokenId_fkey"
    FOREIGN KEY ("replacedByTokenId") REFERENCES "MobileRefreshToken"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MobileProofNonce"
    ADD CONSTRAINT "MobileProofNonce_deviceId_fkey"
    FOREIGN KEY ("deviceId") REFERENCES "MobileDevice"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
