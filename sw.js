const CACHE='scentos-pages-v0-2-0';
const ASSETS=['./','./index.html','./styles.css','./model.js','./db.js','./app.js','./recommendation.js','./weather.js','./manifest.webmanifest','./assets/icon.svg','./scentos_public_catalog.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>(k.startsWith('scentos-pages-')||k.startsWith('scentos-foundation'))&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const url=new URL(e.request.url);if(e.request.method!=='GET'||url.origin!==location.origin)return;e.respondWith(caches.open(CACHE).then(c=>c.match(e.request).then(hit=>hit||fetch(e.request))));});
