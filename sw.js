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
const VERSION = "dn-v1";
const PRECACHE = [
  "./",
  "./index.html",
  "./archive.html",
  "./assets/styles.css",
  "./scripts/util.js",
  "./scripts/storage.js",
  "./scripts/insights.js",
  "./scripts/app.js",
  "./scripts/generate-feed.js",  // 의미 없지만 캐시 안전망
  "./data/today.js",
  "./data/experts.js",
  "./data/archive.js",
  "./manifest.webmanifest",
];

// ── install: 사전 캐싱 ──────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(PRECACHE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
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

  event.respondWith(
    networkWithFallback(req)
  );
});

async function networkWithFallback(req) {
  // network-first, 5초 timeout
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(req, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res && res.ok && res.type === "basic") {
      // 캐시 비동기 갱신
      caches.open(VERSION).then((c) => c.put(req, res.clone())).catch(() => {});
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
