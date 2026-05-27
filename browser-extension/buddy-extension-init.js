(function initBuddyAiFromExtension() {
  const script = document.currentScript;
  const licenseKey = (script?.getAttribute("data-license-key") || "").trim();
  const apiBase = (script?.getAttribute("data-api-base") || "https://www.buddieai.com").replace(/\/$/, "");
  const verifyDomain = (script?.getAttribute("data-verify-domain") || "extension").trim().toLowerCase();
  const cssHref = (script?.getAttribute("data-css-href") || "").trim();

  if (!window.BuddyAI || typeof window.BuddyAI.init !== "function" || !licenseKey) return;

  window.BuddyAI.init({
    licenseKey,
    apiBase,
    verifyDomain,
    cssHref,
  });
})();
