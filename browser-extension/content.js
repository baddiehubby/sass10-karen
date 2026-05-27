(function buddyAiContentScript() {
  const API_BASE = "https://www.buddieai.com";
  const WIDGET_SCRIPT_ID = "buddy-ai-extension-widget-script";
  const CSS_LINK_ID = "buddy-ai-extension-widget-css";
  const ALLOWED_HOSTS = new Set(["chat.openai.com", "chatgpt.com", "claude.ai", "gemini.google.com"]);

  if (!ALLOWED_HOSTS.has(window.location.hostname)) return;

  let bootstrapped = false;

  function markExtensionInstalled() {
    const script = document.createElement("script");
    script.textContent = "window.__buddyExtensionInstalled = true;";
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  function getFromStorage(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  function injectWidgetCss() {
    if (document.getElementById(CSS_LINK_ID)) return;
    const link = document.createElement("link");
    link.id = CSS_LINK_ID;
    link.rel = "stylesheet";
    link.href = chrome.runtime.getURL("vendor/buddy-widget.css");
    (document.head || document.documentElement).appendChild(link);
  }

  function injectBuddyWidget(licenseKey) {
    if (!licenseKey) return;
    if (bootstrapped && document.getElementById("hq-livingface-container")) return;

    const existing = document.getElementById(WIDGET_SCRIPT_ID);
    if (existing) existing.remove();

    const widgetScript = document.createElement("script");
    widgetScript.id = WIDGET_SCRIPT_ID;
    widgetScript.src = chrome.runtime.getURL("vendor/livingface-widget.js");
    widgetScript.async = true;
    widgetScript.dataset.hqKey = licenseKey;
    widgetScript.dataset.hqApi = API_BASE;
    widgetScript.dataset.hqDomain = "extension";
    widgetScript.dataset.hqCss = chrome.runtime.getURL("vendor/buddy-widget.css");
    widgetScript.dataset.hqPosition = "bottom-right";
    widgetScript.dataset.hqManualInit = "true";

    widgetScript.addEventListener("load", () => {
      const initScript = document.createElement("script");
      initScript.textContent = `(() => {
        if (window.__buddyAiExtensionBootstrapped) return;
        if (!window.BuddyAI || typeof window.BuddyAI.init !== "function") return;
        window.BuddyAI.init({
          licenseKey: ${JSON.stringify(licenseKey)},
          apiBase: ${JSON.stringify(API_BASE)},
          verifyDomain: "extension",
          cssHref: ${JSON.stringify(chrome.runtime.getURL("vendor/buddy-widget.css"))},
        });
        window.__buddyAiExtensionBootstrapped = true;
      })();`;
      (document.head || document.documentElement).appendChild(initScript);
      initScript.remove();
      bootstrapped = true;
    });

    (document.head || document.documentElement).appendChild(widgetScript);
  }

  function ensureOrbContainer() {
    if (document.getElementById("hq-livingface-container")) return;
    const host = document.createElement("div");
    host.id = "hq-livingface-container";
    host.setAttribute("data-buddy-extension-placeholder", "true");
    host.style.cssText =
      "position:fixed;bottom:24px;right:24px;width:80px;height:80px;z-index:2147483647;pointer-events:none;border-radius:999px;box-shadow:0 0 24px rgba(99,102,241,0.45);";
    document.body.appendChild(host);
  }

  async function bootWidget() {
    markExtensionInstalled();
    injectWidgetCss();

    const { buddyLicenseKey } = await getFromStorage(["buddyLicenseKey"]);
    const licenseKey = String(buddyLicenseKey || "").trim();

    if (!licenseKey) {
      ensureOrbContainer();
      return;
    }

    injectBuddyWidget(licenseKey);
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.buddyLicenseKey) return;
    bootstrapped = false;
    document.getElementById("hq-livingface-container")?.remove();
    document.getElementById(WIDGET_SCRIPT_ID)?.remove();
    void bootWidget();
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "BUDDY_AI_REFRESH_WIDGET") return false;
    bootstrapped = false;
    void bootWidget()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void bootWidget(), { once: true });
  } else {
    void bootWidget();
  }
})();
