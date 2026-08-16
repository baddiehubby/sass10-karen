/**
 * Authorized remote intelligence — intentionally isolated stub.
 * Not registered by default. Must never become a public API proxy.
 * Must never accept or store user-supplied API keys.
 */

import type { AuthorizedIntelligenceProvider } from "@/src/intelligence/cost/resolve";
import {
  evaluateUserProviderCredential,
  isArbitraryProviderProxyAllowed,
} from "@/src/intelligence/cost/credential-policy";

/**
 * Factory for a Buddie-funded authorized provider.
 * Returns null unless explicitly constructed in ops code with server-side config.
 * User credentials are always rejected.
 */
export function createAuthorizedIntelligenceProvider(opts: {
  /** Server-only secret handle — never a browser-posted user key. */
  serverCredentialRef?: string;
  userPostedApiKey?: string;
}): AuthorizedIntelligenceProvider | null {
  if (opts.userPostedApiKey) {
    evaluateUserProviderCredential({
      apiKey: opts.userPostedApiKey,
      storeOnServer: true,
    });
    return null;
  }
  if (!isArbitraryProviderProxyAllowed()) {
    // Product default: refuse to stand up a forwarding provider.
    // Ops may register a custom adapter via setAuthorizedIntelligenceProvider in a
    // private module — never through a public route that accepts provider URLs/keys.
  }
  if (!opts.serverCredentialRef) return null;
  // No live adapter shipped — keep economic safety if env is flipped on.
  return {
    complete: async () => null,
  };
}
