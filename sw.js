const CACHE='shooting-now-static-v1';
const FILES=['./','./index.html','./styles.css','./app.js','./logic.js','./db.js','./event-default.json','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./assets/map-indoor.webp','./assets/map-outdoor.webp','./assets/timetable-A.webp','./assets/timetable-B.webp','./assets/timetable-C.webp','./assets/timetable-D.webp'];
const CORE=FILES.map(p=>new URL(p,self.registration.scope).toString());
const HOME=new URL('./',self.registration.scope).toString();
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)))});
self.addEventListener('activate',e=>{e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))]))});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const u=new URL(e.request.url);
  if(u.origin!==self.location.origin) return;
  e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{
    if(r && r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}
    return r;
  }).catch(()=>e.request.mode==='navigate'?caches.match(HOME):undefined)));
});
