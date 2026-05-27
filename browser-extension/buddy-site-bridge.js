(function buddySiteBridge() {
  const ALLOWED = /^(www\.)?buddieai\.com$/i;

  if (!ALLOWED.test(window.location.hostname)) return;

  function markInstalled() {
    const script = document.createElement("script");
    script.textContent = "window.__buddyExtensionInstalled = true;";
    (document.head || document.documentElement).appendChild(script);
    script.remove();
  }

  function injectBootstrapFetch() {
    // Content scripts can call fetch directly — no injected <script> needed (MV3 compatible).
    fetch("/api/extensions/bootstrap", {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((payload) => {
        if (!payload?.licenseKey) return;
        window.postMessage(
          { source: "buddy-dashboard-bridge", type: "BUDDY_BOOTSTRAP", payload },
          window.location.origin,
        );
      })
      .catch(() => {
        /* unauthenticated or network error — silent */
      });
  }

  markInstalled();

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data?.source !== "buddy-dashboard-bridge") return;

    if (event.data?.type === "BUDDY_BOOTSTRAP" && event.data.payload?.licenseKey) {
      chrome.runtime.sendMessage({
        type: "BUDDY_APPLY_BOOTSTRAP",
        payload: event.data.payload,
      });
      window.postMessage({ type: "BUDDY_EXTENSION_SYNCED" }, window.location.origin);
    }
  });

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data?.type === "BUDDY_REQUEST_EXTENSION_SYNC") {
      injectBootstrapFetch();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectBootstrapFetch);
  } else {
    injectBootstrapFetch();
  }
})();
