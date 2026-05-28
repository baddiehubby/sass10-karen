import { getTenant, tenantSlugToKey, TENANT_CONFIGS, type TenantKey, type TenantSlug } from "@/lib/tenant";

export type TenantBranding = {
  tenant: TenantKey;
  name: string;
  shortName: string;
  homePath: string;
};

export function brandingForTenant(tenant: TenantKey): TenantBranding {
  if (tenant === "sachapandit") {
    return {
      tenant,
      name: TENANT_CONFIGS.sachapandit.name,
      shortName: "Pandit",
      homePath: "/sachapandit",
    };
  }
  return {
    tenant,
    name: TENANT_CONFIGS.buddy.name,
    shortName: "Buddy",
    homePath: "/",
  };
}

export function brandingFromTenantSlug(slug: TenantSlug): TenantBranding {
  return brandingForTenant(tenantSlugToKey(slug));
}

export function brandingFromHostname(hostname: string | null | undefined): TenantBranding {
  return brandingFromTenantSlug(getTenant(hostname));
}

