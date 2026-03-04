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
  if (event.data) {
    try {
      const data = event.data.json();
      title = data.title || title;
      body = data.body || "";
    } catch (_) {
      body = event.data.text() || "";
    }
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      tag: "reminder",
      requireInteraction: false,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      if (clientList.length) clientList[0].focus();
      else if (self.clients.openWindow) self.clients.openWindow("/");
    })
  );
});
