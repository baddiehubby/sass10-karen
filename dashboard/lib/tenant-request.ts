import { cookies, headers } from "next/headers";
import { getTenant, TENANT_COOKIE, TENANT_HEADER, type TenantSlug } from "@/lib/tenant";

/** Resolve active tenant from middleware header/cookie, then hostname. */
export function getTenantFromRequest(): TenantSlug {
  const headerStore = headers();
  const fromHeader = headerStore.get(TENANT_HEADER);
  if (fromHeader === "buddie" || fromHeader === "sachapandit") return fromHeader;

  const cookieStore = cookies();
  const fromCookie = cookieStore.get(TENANT_COOKIE)?.value;
  if (fromCookie === "buddie" || fromCookie === "sachapandit") return fromCookie;

  return getTenant(headerStore.get("host"));
}
