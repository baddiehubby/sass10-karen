/* Shadow Companion — background sync, periodic check-in, push (imported by Workbox SW) */
const PRESENCE_DB = "buddy-presence";
const PRESENCE_STORE = "kv";
const MOOD_SYNC_TAG = "buddy-mood-sync";
const CHECK_IN_TAG = "buddy-check-in";
const OFFLINE_MOOD_QUEUE = "buddy-offline-mood-queue";

self.addEventListener("install", () => {
  self.skipWaiting();
});

async function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PRESENCE_DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(PRESENCE_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRESENCE_STORE, "readonly");
    const store = tx.objectStore(PRESENCE_STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PRESENCE_STORE, "readwrite");
    const store = tx.objectStore(PRESENCE_STORE);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function getLicenseKey() {
  return (await idbGet("licenseKey")) || "";
}

async function fetchPresenceState(licenseKey) {
  const res = await fetch(`/api/presence/state?licenseKey=${encodeURIComponent(licenseKey)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return null;
  return res.json();
}

async function flushOfflineMoodQueue() {
  const licenseKey = await getLicenseKey();
  if (!licenseKey) return;

  const queue = (await idbGet(OFFLINE_MOOD_QUEUE)) || [];
  if (!Array.isArray(queue) || queue.length === 0) return;

  for (const item of queue) {
    await fetch("/api/presence/state", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Buddy-License-Key": licenseKey,
      },
      body: JSON.stringify({
        licenseKey,
        currentMood: item.mood,
        guidanceText: item.guidanceText,
      }),
    });
  }
  await idbSet(OFFLINE_MOOD_QUEUE, []);
}

async function performCheckIn() {
  const licenseKey = await getLicenseKey();
  if (!licenseKey) return;

  const state = await fetchPresenceState(licenseKey);
  if (!state) return;

  await idbSet("presenceState", state);

  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  clients.forEach((client) => {
    client.postMessage({ type: "BUDDY_PRESENCE_UPDATED", state });
  });

  const recent = (state.moodHistory || []).slice(-4);
  const concernedStreak =
    state.currentMood === "concerned" &&
    recent.length >= 3 &&
    recent.every((e) => e.mood === "concerned");

  if (concernedStreak) {
    await self.registration.showNotification(state.companionName || "Buddy", {
      body: "You seemed stressed earlier. Take a breath?",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: "/dashboard" },
      tag: "buddy-check-in",
    });
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === MOOD_SYNC_TAG) {
    event.waitUntil(flushOfflineMoodQueue());
  }
});

self.addEventListener("periodicsync", (event) => {
  if (event.tag === CHECK_IN_TAG) {
    event.waitUntil(performCheckIn());
  }
});

self.addEventListener("push", (event) => {
  let payload = { title: "Buddy", body: "Your companion is here.", url: "/dashboard" };
  try {
    payload = { ...payload, ...(event.data?.json?.() || {}) };
  } catch {
    /* ignore */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "Buddy", {
      body: payload.body || "I'm listening.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: payload.url || "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "BUDDY_SET_LICENSE_KEY" && data.licenseKey) {
    event.waitUntil(idbSet("licenseKey", data.licenseKey));
  }
  if (data.type === "BUDDY_QUEUE_MOOD" && data.mood) {
    event.waitUntil(
      (async () => {
        const queue = (await idbGet(OFFLINE_MOOD_QUEUE)) || [];
        queue.push({ mood: data.mood, guidanceText: data.guidanceText, at: new Date().toISOString() });
        await idbSet(OFFLINE_MOOD_QUEUE, queue);
        if ("sync" in self.registration) {
          await self.registration.sync.register(MOOD_SYNC_TAG);
        }
      })(),
    );
  }
  if (data.type === "BUDDY_FORCE_CHECK_IN") {
    event.waitUntil(performCheckIn());
  }
});
