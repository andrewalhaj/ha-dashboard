// Jarvis Home — minimal service worker.
// Purpose: satisfy PWA installability. The dashboard is live-data (HA WebSocket),
// so we deliberately do NOT cache app logic — always go to network, fall back to
// a cached shell only when fully offline. Keeps data fresh; never serves stale UI.
const SHELL = "jarvis-shell-v-1780890986";
const SHELL_FILES = ["./", "./index.html", "./dashboard.css", "./dashboard.js", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES).catch(() => {})));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  // Never intercept WebSocket upgrades or non-GET.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Always hit network for API/proxy/live endpoints — never cache live data.
  if (url.pathname.startsWith("/ha-api") || url.pathname.startsWith("/ha-ws") ||
      url.pathname.startsWith("/govee-api") || url.pathname.startsWith("/glances-api") ||
      url.pathname.startsWith("/plex-api") || url.pathname.includes("tv_snapshot")) {
    return; // default browser handling (network)
  }
  // Network-first for the shell; cache fallback only when offline.
  e.respondWith(
    fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(SHELL).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then((m) => m || caches.match("./index.html")))
  );
});
