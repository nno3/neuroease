/* NeuroEase caregiver dashboard service worker – handles push notifications. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => { e.waitUntil(self.clients.claim()); });

self.addEventListener("push", (event) => {
    let title = "NeuroEase";
    let body = "";
    let kind = null;
    let openUrl = null;
    if (event.data) {
        try {
            const data = event.data.json();
            title = data.title || title;
            body = data.body || "";
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
        return;
    }

    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon: "/icon-192.png",
            tag: "neuroease-caregiver",
            requireInteraction: false,
        })
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const rawUrl = event.notification.data && event.notification.data.url;
    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
            let path = "/messages";
            try {
                if (rawUrl) path = new URL(rawUrl).pathname + new URL(rawUrl).search;
            } catch (_) {}
            if (list.length) {
                const c = list[0];
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
