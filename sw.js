const CACHE='noor-traders-v100';
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
      if(!r.ok)return r;
      const cp=r.clone();
      caches.open(CACHE).then(c=>c.put(isLive?new Request(u.pathname):e.request,cp)).catch(()=>{});
      return r;
    }).catch(()=>caches.match(isLive?new Request(u.pathname):e.request).then(x=>x||(e.request.mode==='navigate'?caches.match('./index.html'):Response.error())))
  );
});

// This handles clicks on notifications shown by the connected owner page.
// It is not a background push subscription and receives no events when the app is closed.
self.addEventListener('notificationclick',event=>{
  const data=event.notification.data;event.notification.close();
  if(data?.type!=='NT_TASK_NOTIFICATION'||typeof data.taskId!=='string'||typeof data.ownerUid!=='string')return;
  event.waitUntil((async()=>{
    const scope=new URL(self.registration.scope),windows=await clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of windows){const url=new URL(client.url);if(url.origin===scope.origin&&url.pathname.startsWith(scope.pathname)){await client.focus();client.postMessage({type:'NT_TASK_NOTIFICATION',taskId:data.taskId,ownerUid:data.ownerUid});return}}
    const url=new URL('index.html',scope);url.hash='staffTasks';url.searchParams.set('noticeTask',data.taskId);url.searchParams.set('noticeOwner',data.ownerUid);await clients.openWindow(url.href);
  })());
});
