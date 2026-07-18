/**
 * sw.js — 서비스워커 (WBS 2.2)
 *
 * 전략:
 *  - 셸 자산(HTML/manifest/아이콘): 캐시 우선, 백그라운드 갱신 (stale-while-revalidate)
 *  - GAS API 등 교차 출처 요청: 가로채지 않음 (항상 네트워크)
 * 셸 파일을 바꿀 때마다 CACHE_VERSION을 올려야 기존 설치 기기에 반영된다.
 */

var CACHE_VERSION = 'shell-v1';
var SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) { return cache.addAll(SHELL_ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_VERSION; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);
  // 교차 출처(GAS API 등)는 서비스워커가 관여하지 않는다
  if (url.origin !== location.origin) return;
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.open(CACHE_VERSION).then(function (cache) {
      return cache.match(e.request).then(function (cached) {
        var fetched = fetch(e.request).then(function (res) {
          if (res && res.ok) cache.put(e.request, res.clone());
          return res;
        }).catch(function () { return cached; });
        return cached || fetched;
      });
    })
  );
});
