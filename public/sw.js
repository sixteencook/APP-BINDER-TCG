// Service worker TCG Binder v2
// - pages et scripts : réseau d'abord (toujours la dernière version), cache en secours hors ligne
// - images des cartes (TCGdex et sources de secours) : cache d'abord, pour que le binder reste visible sans réseau
// - /api/* : jamais mis en cache ici (les prix ont leur propre cache applicatif)
const SHELL = "tcg-binder-shell-v2";
const IMAGES = "tcg-binder-images-v2";
const MAX_IMAGES = 600;
const PRECACHE = ["/", "/manifest.webmanifest", "/favicon.svg", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL && key !== IMAGES).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function trimImages(cache) {
  const keys = await cache.keys();
  if (keys.length > MAX_IMAGES) await Promise.all(keys.slice(0, keys.length - MAX_IMAGES).map((key) => cache.delete(key)));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Images de cartes (TCGdex, TCGGO, CDN Pokémon TCG…) : toute image tierce est servie cache d'abord.
  if (request.destination === "image" && url.origin !== self.location.origin) {
    event.respondWith(
      caches.open(IMAGES).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        try {
          const response = await fetch(request);
          if (response.ok || response.type === "opaque") {
            cache.put(request, response.clone());
            trimImages(cache);
          }
          return response;
        } catch {
          return hit ?? Response.error();
        }
      }),
    );
    return;
  }

  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request).then((hit) => hit ?? caches.match("/"))),
  );
});
