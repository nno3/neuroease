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
  if (url.origin !== self.location.origin) {
    return;
  }
  if (url.pathname.includes("/socket.io/")) {
    return;
  }
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
  let kind = null;
  let openUrl = null;
  if (event.data) {
    try {
      const data = event.data.json();
      title = data.title || title;
      body = data.body || "";
      reminderId = data.reminderId != null ? data.reminderId : null;
      kind = data.kind || null;
      openUrl = typeof data.openUrl === "string" ? data.openUrl : null;
    } catch (_) {
      body = event.data.text() || "";
    }
  }

  if (kind === "incoming-call") {
    const u = openUrl || self.location.origin + "/messages";
    event.waitUntil(
      self.registration.showNotification(title || "Incoming call", {
        body: body || "Open to answer",
        icon: "/icon-192.png",
        tag: "incoming-call",
        renotify: true,
        requireInteraction: true,
        data: { url: u, kind: "incoming-call" },
      })
    );
    const post = self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      list.forEach((c) => {
        try {
          c.postMessage({ type: "incoming-call-foreground", url: u });
        } catch (_) {}
      });
    });
    event.waitUntil(post);
    return;
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
  const rawUrl = event.notification.data && event.notification.data.url;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      let path = "/";
      try {
        if (rawUrl) path = new URL(rawUrl).pathname + new URL(rawUrl).search;
      } catch (_) {}
      if (clientList.length) {
        const c = clientList[0];
        try {
          c.postMessage({ type: "sw-navigate", url: path });
        } catch (_) {}
        return c.focus();
      }
      if (rawUrl && self.clients.openWindow) return self.clients.openWindow(rawUrl);
      if (self.clients.openWindow) return self.clients.openWindow(self.location.origin + path);
    })
  );
});
