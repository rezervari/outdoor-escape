/*
 * Outdoor Escape — service worker MINIMAL (fundație).
 *
 * Ce face:
 * - la instalare, pune în cache doar fișierele fundației (SHELL_FILES);
 * - pentru aceste fișiere: rețea mai întâi, cache ca rezervă (network-first);
 * - la activare, șterge versiunile vechi ale cache-ului fundației.
 *
 * Ce NU face (în această etapă):
 * - NU oferă offline complet și nu garantează funcționarea offline;
 * - NU pune în cache nimic din ../content/ (conținutul jocurilor);
 * - NU pune în cache răspunsuri dinamice, cereri către alte domenii
 *   sau orice fișier care nu este în SHELL_FILES;
 * - NU folosește biblioteci.
 *
 * Scope: folderul src/ (D-035), pentru că sw.js stă în src/.
 * Toate căile sunt relative la locația acestui fișier.
 *
 * Actualizare: la orice schimbare a fișierelor fundației se mărește
 * CACHE_VERSION. Cache-urile vechi cu prefixul CACHE_PREFIX sunt șterse
 * la activare. Cache-urile altor site-uri de pe același domeniu
 * (rezervari.github.io) nu sunt atinse.
 */

const CACHE_PREFIX = "outdoor-escape:shell:";
const CACHE_VERSION = "v1";
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

// Relative la sw.js, adică la src/.
const SHELL_FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/app.css",
  "js/app.js",
];

const SHELL_URLS = new Set(
  SHELL_FILES.map((path) => new URL(path, self.location.href).href)
);
const SCOPE_ROOT = new URL("./", self.location.href).href;
const INDEX_URL = new URL("index.html", self.location.href).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = request.mode === "navigate";
  // Cheia din cache nu include query string-ul; hash-ul nu ajunge
  // niciodată la service worker.
  let key = url.origin + url.pathname;
  // src/ și src/index.html sunt aceeași pagină.
  if (isNavigation && key === INDEX_URL) key = SCOPE_ROOT;

  // Orice altceva (inclusiv ../content/) nu este interceptat.
  if (!SHELL_URLS.has(key)) return;
  // Query string-ul este acceptat doar la navigare (ex. src/?test=1).
  if (url.search && !isNavigation) return;

  event.respondWith(networkFirst(request, key));
});

async function networkFirst(request, key) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      await cache.put(key, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(key);
    if (cached) return cached;
    throw error;
  }
}
