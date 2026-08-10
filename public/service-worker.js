/* Ladel's push-only service worker. No fetch handler or offline cache by design. */
const ALLOWED_ROUTES = new Set(["/", "/menu", "/account", "/orders"]);
function safeDestination(value) {
  try {
    const url = new URL(value || "/", self.location.origin);
    if (url.origin !== self.location.origin || !ALLOWED_ROUTES.has(url.pathname)) return new URL("/", self.location.origin).href;
    return url.href;
  } catch { return new URL("/", self.location.origin).href; }
}
self.addEventListener("push", (event) => {
  let payload;
  try { payload = event.data?.json(); } catch { return; }
  if (!payload || payload.version !== 1 || typeof payload.title !== "string" || typeof payload.body !== "string") return;
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body, icon: "/icon-192.png", badge: "/icon-192.png",
    tag: payload.announcementId ? `announcement-${payload.announcementId}` : undefined,
    data: { destination: safeDestination(payload.destination), announcementId: payload.announcementId },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = safeDestination(event.notification.data?.destination);
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (windows) => {
    for (const windowClient of windows) {
      if (new URL(windowClient.url).origin === self.location.origin) {
        try {
          await windowClient.navigate(destination);
          return await windowClient.focus();
        } catch { /* Try another client or open a new same-origin window. */ }
      }
    }
    return clients.openWindow(destination);
  }));
});
