/* Minimal service worker for PWA installability. */
const CACHE_NAME = "neuroease-patient-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  /* Do not proxy cross-origin requests (e.g. Socket.IO on :5001) — avoids brittle failures. */
  if (url.origin !== self.location.origin) {
    return;
  }
  if (url.pathname.includes("/socket.io/")) {
    return;
  }
  /* Offline: serve index.html for navigation requests (SPA). */
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match("/index.html").then((r) => r || new Response("Offline", { status: 503 }))
      )
    );
    return;
  }
  event.respondWith(fetch(event.request));
});

self.addEventListener("push", (event) => {
  let title = "Reminder";
  let body = "";
  let reminderId = null;
  if (event.data) {
    try {
      const data = event.data.json();
      title = data.title || title;
      body = data.body || "";
      reminderId = data.reminderId != null ? data.reminderId : null;
    } catch (_) {
      body = event.data.text() || "";
    }
  }
  const showNotif = self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
    tag: "reminder",
    requireInteraction: false,
  });
  const storePending = reminderId != null
    ? openVoiceAssistDB().then((db) => putPendingReminder(db, reminderId, title, body)).catch(() => {})
    : Promise.resolve();
  // If app is already open, postMessage so it can speak immediately
  const notifyClients = reminderId != null
    ? self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
        list.forEach((c) => {
          try {
            c.postMessage({ type: "voice-assist-push", reminderId, title, body });
          } catch (_) {}
        });
      })
    : Promise.resolve();
  event.waitUntil(Promise.all([showNotif, storePending, notifyClients]));
});

function openVoiceAssistDB() {
  return new Promise((resolve, reject) => {
    const req = self.indexedDB.open("neuroease-voice-assist", 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("pending")) {
        db.createObjectStore("pending", { keyPath: "id" });
      }
    };
  });
}

function putPendingReminder(db, reminderId, title, body) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("pending", "readwrite");
    const store = tx.objectStore("pending");
    store.put({ id: "latest", reminderId, pushedAt: Date.now(), title, body });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      if (clientList.length) clientList[0].focus();
      else if (self.clients.openWindow) self.clients.openWindow("/");
    })
  );
});
