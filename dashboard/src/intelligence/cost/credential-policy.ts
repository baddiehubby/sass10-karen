/**
 * Credential / BYOK policy for intelligence.
 * Buddie must never store user-supplied provider API keys insecurely —
 * and the core product does not accept BYOK at all today.
 */

export type ProviderCredentialDecision =
  | { accepted: false; reason: "byok_disabled" | "insecure_storage_forbidden" | "proxy_forbidden" }
  | { accepted: true; storage: "never" };

/**
 * Reject any attempt to register or persist a user-owned provider credential.
 * Authorized Buddie-funded adapters (if ever enabled) use server env only —
 * never raw keys from the client.
 */
export function evaluateUserProviderCredential(_input: {
  provider?: string;
  apiKey?: string;
  storeOnServer?: boolean;
}): ProviderCredentialDecision {
  void _input;
  return { accepted: false, reason: "byok_disabled" };
}

/** Hard rule: no HTTP proxy that forwards arbitrary provider requests. */
export function isArbitraryProviderProxyAllowed(): false {
  return false;
}
