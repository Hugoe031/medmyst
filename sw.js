const CACHE = "medmyst-v13";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./favicon.ico",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/apple-touch-icon.png",
  "./assets/splash.webp",
  "./src/main.js",
  "./src/data/questions.js",
  "./src/data/wordhunt.js",
  "./src/core/rng.js",
  "./src/core/scheduler.js",
  "./src/core/game.js",
  "./src/core/storage.js",
  "./src/core/progress.js",
  "./src/core/share.js",
  "./src/core/practice.js",
  "./src/core/review.js",
  "./src/core/rewarded.js",
  "./src/core/wordgrid.js",
  "./src/core/hunt.js",
  "./src/core/missions.js",
  "./src/core/missed.js",
  "./src/core/notifications.js",
  "./src/core/build-config.js",
  "./src/core/update.js",
  "./src/rewarded-overlay.js",
  "./assets/ambience.mp3",
  "./assets/audio/music-synthwave.mp3",
  "./assets/audio/success.mp3",
  "./assets/audio/explosion.mp3",
  "./assets/audio/applause.mp3",
  "./assets/audio/disappointment.mp3",
  "./PRIVACY_POLICY.md"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== location.origin) {
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? caches.match("./index.html")))
  );
});


