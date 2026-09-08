const CACHE='noor-traders-v98';
self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(Promise.all([clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))]))});
self.addEventListener('message',e=>{if(e.data==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==location.origin)return;
  const isLive=e.request.mode==='navigate'||u.pathname.endsWith('/')||u.pathname.endsWith('index.html')||u.pathname.endsWith('version.json')||u.pathname.endsWith('sw.js');
  e.respondWith(
    fetch(e.request,{cache:'no-store'}).then(r=>{
      // index.html / version.json hamesha internet se; sirf offline ke liye copy rakhi jati hai.
      const cp=r.clone();
      caches.open(CACHE).then(c=>c.put(isLive?new Request(u.pathname):e.request,cp)).catch(()=>{});
      return r;
    }).catch(()=>caches.match(isLive?new Request(u.pathname):e.request).then(x=>x||caches.match('./index.html')))
  );
});
