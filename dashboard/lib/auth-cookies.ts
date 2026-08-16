import type { CookiesOptions } from "next-auth";

/**
 * Explicit NextAuth cookie policy — HttpOnly session, Secure in production, SameSite=Lax.
 * PKCE verifier + state cookies required for Google OAuth (checks: pkce, state).
 */
export function buildAuthCookies(isProduction: boolean): Partial<CookiesOptions> {
  const secure = isProduction;
  const base = {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure,
  };

  return {
    sessionToken: {
      name: secure ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: { ...base },
    },
    callbackUrl: {
      name: secure ? "__Secure-next-auth.callback-url" : "next-auth.callback-url",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure,
      },
    },
    csrfToken: {
      name: secure ? "__Host-next-auth.csrf-token" : "next-auth.csrf-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure,
      },
    },
    pkceCodeVerifier: {
      name: secure ? "__Secure-next-auth.pkce.code_verifier" : "next-auth.pkce.code_verifier",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure,
        maxAge: 60 * 15,
      },
    },
    state: {
      name: secure ? "__Secure-next-auth.state" : "next-auth.state",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure,
        maxAge: 60 * 15,
      },
    },
  };
}
