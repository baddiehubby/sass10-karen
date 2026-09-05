import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes, sign } from "node:crypto";
import test from "node:test";

import {
  base64UrlSha256,
  issueMobileHandoff,
  issueMobileRefresh,
  mobileCredentialVersion,
  mobileProofMessage,
  validateDevicePublicKey,
  verifyDeviceProof,
  verifyMobileHandoff,
  verifyMobileRefresh,
  verifyPkceVerifier,
} from "../../lib/mobile-auth";

process.env.NEXTAUTH_SECRET = "mobile-auth-test-secret-at-least-32-characters";

function deviceFixture() {
  const { publicKey, privateKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  const spki = publicKey.export({ format: "der", type: "spki" }).toString("base64url");
  return { privateKey, spki };
}

test("mobile handoff is PKCE- and device-bound", async () => {
  const device = deviceFixture();
  const verifier = randomBytes(48).toString("base64url");
  const state = randomBytes(32).toString("base64url");
  const code = await issueMobileHandoff({
    userId: "user_mobile_test",
    licenseId: "license_mobile_test",
    codeChallenge: base64UrlSha256(verifier),
    state,
    devicePublicKey: device.spki,
  });

  const claims = await verifyMobileHandoff(code);
  assert.ok(claims);
  assert.equal(claims.uid, "user_mobile_test");
  assert.equal(claims.lid, "license_mobile_test");
  assert.equal(claims.sth, base64UrlSha256(state));
  assert.equal(verifyPkceVerifier(verifier, claims.cch), true);
  assert.equal(verifyPkceVerifier(`${verifier}x`, claims.cch), false);
});

test("device proof rejects tampering and stale timestamps", () => {
  const device = deviceFixture();
  const credential = "signed-credential-value";
  const timestamp = Date.now();
  const nonce = randomBytes(24).toString("base64url");
  const message = mobileProofMessage({
    purpose: "exchange",
    credential,
    timestamp,
    nonce,
  });
  const signature = sign("sha256", Buffer.from(message), device.privateKey).toString("base64url");

  assert.equal(
    verifyDeviceProof({
      purpose: "exchange",
      credential,
      timestamp,
      nonce,
      signature,
      spki: device.spki,
      now: timestamp,
    }),
    true,
  );
  assert.equal(
    verifyDeviceProof({
      purpose: "exchange",
      credential: `${credential}-tampered`,
      timestamp,
      nonce,
      signature,
      spki: device.spki,
      now: timestamp,
    }),
    false,
  );
  assert.equal(
    verifyDeviceProof({
      purpose: "exchange",
      credential,
      timestamp,
      nonce,
      signature,
      spki: device.spki,
      now: timestamp + 61_000,
    }),
    false,
  );
});

test("refresh credentials retain device and credential-version binding", async () => {
  const device = deviceFixture();
  assert.equal(validateDevicePublicKey(device.spki), true);

  const issued = await issueMobileRefresh({
    userId: "user_mobile_test",
    licenseId: "license_mobile_test",
    credentialVersion: mobileCredentialVersion("password-hash"),
    devicePublicKey: device.spki,
  });
  const claims = await verifyMobileRefresh(issued.token);

  assert.ok(claims);
  assert.equal(claims.uid, "user_mobile_test");
  assert.equal(claims.lid, "license_mobile_test");
  assert.equal(claims.cv, mobileCredentialVersion("password-hash"));
  assert.equal(claims.spki, device.spki);
  assert.ok(issued.expiresAt > Date.now());
});

test("invalid public keys are rejected", () => {
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }).publicKey
    .export({ format: "der", type: "spki" })
    .toString("base64url");
  assert.equal(validateDevicePublicKey(rsa), false);
  assert.equal(validateDevicePublicKey("not-a-key"), false);
});
