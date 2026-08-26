/**
 * Runs on Vercel build only. When LEMONSQUEEZY_PRO_VARIANT_ID is missing,
 * resolves the Pro variant from Lemon Squeezy and creates the env var via Vercel API.
 */
if (process.env.VERCEL !== "1") process.exit(0);

const existing = (process.env.LEMONSQUEEZY_PRO_VARIANT_ID || "").trim();
if (existing && /^\d+$/.test(existing) && existing !== "1063374") {
  console.log("[ensure-pro-variant] already configured");
  process.exit(0);
}

const apiKey = (process.env.LEMONSQUEEZY_API_KEY || "").trim();
const oidc = (process.env.VERCEL_OIDC_TOKEN || "").trim();
const projectId = (process.env.VERCEL_PROJECT_ID || "").trim();
const teamId = (process.env.VERCEL_ORG_ID || "").trim();
const starterId = (process.env.LEMONSQUEEZY_STARTER_VARIANT_ID || "").trim();
const agencyId = (process.env.LEMONSQUEEZY_AGENCY_VARIANT_ID || "").trim();

if (!apiKey || !oidc || !projectId) {
  console.log("[ensure-pro-variant] skip missing api/oidc/project");
  process.exit(0);
}

const teamQ = teamId ? `?teamId=${teamId}` : "";

async function listAllVariants() {
  const r = await fetch("https://api.lemonsqueezy.com/v1/variants?filter[status]=published&page[size]=100", {
    headers: { Accept: "application/vnd.api+json", Authorization: `Bearer ${apiKey}` },
  });
  const j = await r.json();
  if (!r.ok) {
    console.log("[ensure-pro-variant] lemon variants failed status=" + r.status);
    return [];
  }
  return j.data || [];
}

const variants = await listAllVariants();
for (const item of variants) {
  const a = item.attributes || {};
  console.log(
    `[ensure-pro-variant] variant id=${item.id} product=${a.product_id} name=${(a.name || "").trim()} price=${a.price || 0}`,
  );
}

const known = new Set([starterId, agencyId, "1063374"].filter(Boolean));

function pickPro(items) {
  const byName = items.find((item) => {
    const name = (item.attributes?.name || "").toLowerCase();
    return name.includes("pro") && !name.includes("trial") && !name.includes("premium");
  });
  if (byName) return byName;

  const byPrice = items.find((item) => {
    const price = Number(item.attributes?.price || 0);
    return price === 3500 || price === 2999;
  });
  if (byPrice) return byPrice;

  const remaining = items.filter((item) => !known.has(String(item.id)));
  if (remaining.length === 1) return remaining[0];

  return null;
}

const pro = pickPro(variants);
if (!pro?.id) {
  console.log("[ensure-pro-variant] no pro variant resolved");
  process.exit(0);
}

const proId = String(pro.id);
console.log("[ensure-pro-variant] setting LEMONSQUEEZY_PRO_VARIANT_ID id=" + proId);

const envRes = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env${teamQ}`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${oidc}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    key: "LEMONSQUEEZY_PRO_VARIANT_ID",
    value: proId,
    type: "plain",
    target: ["production", "preview"],
  }),
});

const envJson = await envRes.json();
console.log("[ensure-pro-variant] vercel env post status=" + envRes.status);
if (!envRes.ok) {
  console.log("[ensure-pro-variant] vercel error=" + JSON.stringify(envJson).slice(0, 200));
}
