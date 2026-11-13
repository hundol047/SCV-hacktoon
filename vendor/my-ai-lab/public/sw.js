// 오프라인 지원 + 빠른 재방문
// - 앱 파일: 온라인에서 최신 파일을 받고 오프라인에서 캐시 사용 (network-first)
// - 지도 타일·사진: 한 번 받으면 캐시에서 (cache-first). 앱을 업데이트해도 지우지 않는 별도 캐시에 두고(산간 지역 오프라인용), 너무 많아지면 오래된 것부터 지운다
// - AI·날씨·경로 등 API: 항상 네트워크
const CACHE = "bopok-bright-v7";
const MEDIA_CACHE = "ohneul-gangwon-media-v1"; // 앱 버전과 따로 유지
const MEDIA_MAX = 1500; // 지도 조각·사진 최대 개수 (조각 1개 약 10~30KB)
const SHELL = ["./", "index.html", "style.css", "bopok-bright.css", "app.js", "booking-links.js", "planner.js", "mobility.js", "half-documents.js", "data.js", "extra-places.js", "places-more.js", "pet-places.js", "pet.json", "access-data.js", "transit.js", "transit.json", "bus.json", "crowd.json", "parking.json", "parking-lots.json", "intro.json", "menu.json", "i18n.js", "data-en.json", "photos.json", "lodging-places.json", "fees.json", "costs.js", "alerts.js", "today.js", "directory-place.js", "origins.js", "voice-parse.js", "sun.js", "ai-local.js", "guide-topics.js", "knowledge.js", "knowledge-intl.js", "i18n-cjk.js", "icon.svg", "icon-192.png", "apple-touch-icon.png", "manifest.webmanifest", "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css", "vendor/maplibre/maplibre-gl.js", "vendor/maplibre/maplibre-gl.css", "vendor/pretendard/pretendardvariable-dynamic-subset.css"];
const MEDIA = /tile\.openstreetmap\.org|elevation-tiles-prod|tiles\.openfreemap\.org|upload\.wikimedia\.org|tong\.visitkorea\.or\.kr|\.woff2$/;
const LIVE = /\/api\/|open-meteo|project-osrm|wikipedia\.org\/api/;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => /^(bopok-|yeohaengit-my-ai-lab-|ohneul-gangwon-v)/.test(k) && k !== CACHE && k !== MEDIA_CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = req.url;
  if (/\/(booking|booking-status|admin|reviews|receipt|service-i18n|service-translations)\.(html|js)(\?|$)/.test(url) || /\/service-ui\.js/.test(url)) return;
  if (LIVE.test(url)) return; // 브라우저 기본 동작(네트워크)
  if (MEDIA.test(url)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); e.waitUntil(caches.open(MEDIA_CACHE).then((c) => c.put(req, copy)).then(trimMedia)); }
      return res;
    })));
    return;
  }
  if (new URL(url).origin !== location.origin) return;
  // Fresh app files on every online visit; retain a cached shell for offline use.
  e.respondWith(caches.open(CACHE).then(async (c) => {
    try {
      const fresh=await fetch(req,{cache:'no-cache'});
      if(fresh.ok) {const copy=fresh.clone();e.waitUntil(c.put(req,copy));}
      return fresh;
    } catch(error) {
      const hit=await c.match(req) || await c.match(req,{ignoreSearch:true});
      if(hit)return hit;
      throw error;
    }
  }));
});

// 지도·사진 캐시가 MEDIA_MAX를 넘으면 먼저 넣은 것부터 지운다 (Cache API의 keys()는 넣은 순서)
let trimming = null;
function trimMedia() {
  return (trimming ??= caches.open(MEDIA_CACHE).then(async (c) => {
    const keys = await c.keys();
    for (const k of keys.slice(0, Math.max(0, keys.length - MEDIA_MAX))) await c.delete(k);
  }).finally(() => { trimming = null; }));
}

// Generic notifications contain no booking IDs, lookup keys, names or contact details.
self.addEventListener('push', event => {
  let data={};try{data=event.data?.json()||{};}catch{}
  event.waitUntil(self.registration.showNotification(String(data.title||'Booking update').slice(0,80),{
    body:String(data.body||'Open the status page to check.').slice(0,220),
    icon:new URL('icon-192.png',self.registration.scope).href,tag:'booking-update',
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const target=new URL('booking-status.html',self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(windows=>{
    const existing=windows.find(w=>w.url.split(/[?#]/)[0]===target);
    return existing?existing.focus():self.clients.openWindow(target);
  }));
});
