/* NeuroEase caregiver dashboard service worker – handles push notifications. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener("push", (event) => {
    let title = "NeuroEase";
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
            icon: "/vite.svg",
            tag: "neuroease-caregiver",
            requireInteraction: false,
        })
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
            if (list.length) list[0].focus();
            else if (self.clients.openWindow) self.clients.openWindow("/messages");
        })
    );
});
