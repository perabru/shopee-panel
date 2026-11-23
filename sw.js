'use strict';
// Increment when publishing changed app assets. This worker owns only its scoped cache.
const VERSION = '2026-11-23-url-v2';
const PREFIX = 'vitrine-livre-' + self.registration.scope + '-';
const CACHE = PREFIX + VERSION;
const BASE = self.registration.scope;
const OFFLINE = new URL('offline.html',BASE).href;
// Required shell files: installation fails safely if a deployment omits one.
const ASSETS = [
  'offline.html','styles.css','easy.css','app.js','product-page.js','product-tools.js','pwa.js',
  'manifest.webmanifest','icon.svg','icons/icon-192.png','icons/icon-512.png',
  'icons/maskable-512.png','icons/apple-touch-icon.png'
].map(path=>new URL(path,BASE).href);
const ASSET_SET = new Set(ASSETS);

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
  // Updated workers wait for the user or for all older app windows to close.
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith(PREFIX) && key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message',event=>{
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});
async function navigate(request) {
  let timer;
  const controller = new AbortController();
  try {
    const timeout = new Promise((_,reject)=>{
      timer = setTimeout(()=>{controller.abort();reject(new Error('navigation-timeout'));},9000);
    });
    const response = await Promise.race([fetch(new Request(request,{signal:controller.signal})),timeout]);
    if (response.status >= 500) throw new Error('site-unavailable');
    return response;
  } catch {
    return await (await caches.open(CACHE)).match(OFFLINE) || new Response('Sem conexão. Conecte-se à internet e tente novamente.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  } finally { clearTimeout(timer); }
}
async function staticAsset(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === 'basic') await cache.put(request,response.clone());
    return response;
  } catch {
    return await cache.match(request) || Response.error();
  }
}
self.addEventListener('fetch',event=>{
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(BASE)) return;
  if (request.mode === 'navigate') { event.respondWith(navigate(request)); return; }
  // Never cache database responses, auth, API calls, remote photos or arbitrary paths.
  if (ASSET_SET.has(url.href)) event.respondWith(staticAsset(request));
});
