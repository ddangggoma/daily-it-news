/**
 * sw.js — Daily News Service Worker.
 *
 * 전략 (단순 + 정확):
 *   - 정적 자산 (HTML/CSS/JS): network-first, fallback cache. 매일 today.js
 *     갱신을 항상 신선하게 받기 위함. 오프라인일 때만 캐시 사용.
 *   - 데이터 (data/*.js, feed.xml): network-first, 5초 timeout, 그 후 cache.
 *   - 외부 도메인: 네트워크 그대로 (캐시 안 함). 캐시 폭증 방지.
 *
 * 캐시 키: 'dn-v1' (배포 시 sw.js의 VERSION 변경 → 자동 invalidation).
 */
const VERSION = "dn-v2";   // bumped for cache invalidation after SW fix
const PRECACHE = [
  "./",
  "./index.html",
  "./archive.html",
  "./assets/styles.css",
  "./scripts/util.js",
  "./scripts/storage.js",
  "./scripts/insights.js",
  "./scripts/app.js",
  "./data/today.js",
  "./data/experts.js",
  "./data/archive.js",
  "./manifest.webmanifest",
];
// generate-feed.js intentionally NOT precached: it is Node-only and a 404 would
// cause cache.addAll (atomic) to reject the whole batch.

// ── install: 사전 캐싱 — Promise.allSettled로 atomic 문제 회피 ──────
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // Per-URL puts so one 404 doesn't void the entire precache. Failures are
    // surfaced (not silently swallowed) so chrome://inspect can see them.
    const results = await Promise.allSettled(
      PRECACHE.map((url) => cache.add(url))
    );
    results.forEach((r, i) => {
      if (r.status === "rejected") console.warn("[sw] precache miss:", PRECACHE[i], r.reason);
    });
    await self.skipWaiting();
  })());
});

// ── activate: 옛 버전 캐시 정리 ─────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── fetch: network-first with cache fallback ────────────
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // 같은 origin만 캐시 대상
  if (url.origin !== self.location.origin) return;

  event.respondWith(networkWithFallback(req, event));
});

async function networkWithFallback(req, event) {
  // network-first, 5초 timeout
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(req, { signal: ctrl.signal });
    clearTimeout(timer);
    // Cache only basic 2xx responses. Compare res.url to req.url to avoid pinning
    // an unintended response on accidental cross-origin redirect (defense in depth).
    if (res && res.ok && res.type === "basic" && res.url === req.url) {
      // event.waitUntil keeps the SW alive until cache.put settles. Without this,
      // the browser can terminate mid-put and leave a stale cache entry.
      // Closes frontend-races FR-5 + reliability REL-006.
      const putPromise = caches.open(VERSION)
        .then((c) => c.put(req, res.clone()))
        .catch((err) => console.warn("[sw] cache.put failed:", req.url, err));
      if (event && typeof event.waitUntil === "function") event.waitUntil(putPromise);
    }
    return res;
  } catch (e) {
    clearTimeout(timer);
    // network 실패 → cache fallback
    const cached = await caches.match(req);
    if (cached) return cached;
    // 마지막 보루: 오프라인 안내
    if (req.mode === "navigate") {
      return new Response(
        `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>오프라인</title></head>
         <body style="font-family: system-ui; padding: 2rem; text-align: center;">
           <h1>오프라인 상태</h1>
           <p>네트워크 연결을 확인해 주세요.</p>
           <button onclick="location.reload()">새로고침</button>
         </body></html>`,
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 }
      );
    }
    throw e;
  }
}
