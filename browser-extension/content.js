(function buddyAiContentScript() {
  const API_BASE = "https://app.buddieai.com";
  const SCRIPT_ID = "buddy-ai-extension-widget-script";
  const INIT_SCRIPT_ID = "buddy-ai-extension-init-script";
  const ALLOWED_HOSTS = new Set(["chat.openai.com", "chatgpt.com", "claude.ai", "gemini.google.com"]);

  const PLATFORM =
    window.location.hostname === "claude.ai"
      ? "claude"
      : window.location.hostname === "gemini.google.com"
        ? "gemini"
        : "chatgpt";
  const CHAT_SURFACE_SELECTORS = [
    '[data-message-author-role="assistant"]',
    '[data-testid*="assistant"]',
    '[data-testid*="response"]',
    ".claude-message",
    "[class*='claude'][class*='message']",
    "[class*='response-content']",
    "[class*='model-response']",
    "main",
    "[role='main']",
  ];

  if (!ALLOWED_HOSTS.has(window.location.hostname)) return;

  let lastInjectedKey = "";
  let waitingForSurface = false;

  function getFromStorage(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  function findChatSurface() {
    for (const selector of CHAT_SURFACE_SELECTORS) {
      const node = document.querySelector(selector);
      if (node) return node;
    }
    return document.body;
  }

  function removeExistingWidget() {
    document.getElementById(INIT_SCRIPT_ID)?.remove();
    document.getElementById(SCRIPT_ID)?.remove();
    document.getElementById("hq-livingface-container")?.remove();
  }

  function injectInitScript(licenseKey) {
    const initScript = document.createElement("script");
    initScript.id = INIT_SCRIPT_ID;
    initScript.src = chrome.runtime.getURL("buddy-extension-init.js");
    initScript.dataset.licenseKey = licenseKey;
    initScript.dataset.apiBase = API_BASE;
    initScript.dataset.verifyDomain = "extension";
    initScript.dataset.cssHref = chrome.runtime.getURL("vendor/buddy-widget.css");
    initScript.addEventListener("load", () => {
      initScript.remove();
      lastInjectedKey = licenseKey;
      window.dispatchEvent(
        new CustomEvent("buddy-ai-extension-ready", {
          detail: { platform: PLATFORM, host: window.location.hostname },
        }),
      );
    });
    (document.head || document.documentElement).appendChild(initScript);
  }

  function injectWidget(licenseKey) {
    if (!licenseKey || !document.body) return;
    if (lastInjectedKey === licenseKey && document.getElementById("hq-livingface-container")) return;

    removeExistingWidget();

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = chrome.runtime.getURL("vendor/livingface-widget.js");
    script.async = true;
    script.dataset.hqKey = licenseKey;
    script.dataset.hqApi = API_BASE;
    script.dataset.hqDomain = "extension";
    script.dataset.hqCss = chrome.runtime.getURL("vendor/buddy-widget.css");
    script.dataset.hqPosition = "bottom-right";
    script.dataset.hqManualInit = "true";
    script.addEventListener("load", () => injectInitScript(licenseKey));

    (document.head || document.documentElement).appendChild(script);
  }

  async function bootWhenReady() {
    const { buddyLicenseKey } = await getFromStorage(["buddyLicenseKey"]);
    const licenseKey = String(buddyLicenseKey || "").trim();

    if (!licenseKey) {
      removeExistingWidget();
      lastInjectedKey = "";
      return;
    }

    const surface = findChatSurface();
    if (surface) {
      injectWidget(licenseKey);
      return;
    }

    if (waitingForSurface) return;
    waitingForSurface = true;

    const observer = new MutationObserver(() => {
      if (!findChatSurface()) return;
      waitingForSurface = false;
      observer.disconnect();
      injectWidget(licenseKey);
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => {
      waitingForSurface = false;
      observer.disconnect();
      injectWidget(licenseKey);
    }, 8000);
  }

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.buddyLicenseKey) return;
    bootWhenReady();
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "BUDDY_AI_REFRESH_WIDGET") return false;
    bootWhenReady()
      .then(() => sendResponse({ ok: true }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  });

  bootWhenReady();
})();
