'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname,'..');
const scope = 'https://perabru.github.io/shopee-panel/';
const source = fs.readFileSync(path.join(root,'sw.js'),'utf8');
function basicResponse(body,status=200) {
  const response = new Response(body,{status});
  Object.defineProperty(response,'type',{value:'basic'});
  return response;
}

function workerFixture({fetchResponse=async()=>basicResponse('network')}={}) {
  const handlers = {};
  const stores = new Map();
  const calls = {fetch:[],put:[],precache:[],deleted:[],skipWaiting:0,claim:0};
  const timers = new Map();
  let timerId = 0;
  const cacheFor = name => {
    if (!stores.has(name)) stores.set(name,new Map());
    const entries = stores.get(name);
    return {
      async addAll(urls) {
        calls.precache.push(...urls);
        for (const url of urls) {
          assert(url.startsWith(scope),'precache stays inside this app');
          const relative = url.slice(scope.length);
          const file = path.join(root,relative);
          assert(fs.existsSync(file),'required installation asset exists: '+relative);
          entries.set(url,new Response(fs.readFileSync(file)));
        }
      },
      async match(request) { return entries.get(typeof request==='string'?request:request.url)?.clone(); },
      async put(request,response) {
        const url = typeof request==='string'?request:request.url;
        calls.put.push(url);
        entries.set(url,response);
      }
    };
  };
  const context = {
    URL,Set,Response,AbortController,console,
    Request:class { constructor(request,options={}) { Object.assign(this,request,options); } },
    setTimeout(fn,ms) { const id=++timerId;timers.set(id,{fn,ms});return id; },
    clearTimeout(id) { timers.delete(id); },
    self:{
      registration:{scope},location:{origin:new URL(scope).origin},
      clients:{claim:async()=>{calls.claim++;}},
      skipWaiting:()=>{calls.skipWaiting++;},
      addEventListener:(name,handler)=>{handlers[name]=handler;}
    },
    caches:{
      open:async name=>cacheFor(name),
      keys:async()=>[...stores.keys()],
      delete:async name=>{calls.deleted.push(name);return stores.delete(name);}
    },
    fetch:async request=>{calls.fetch.push(request);return fetchResponse(request);}
  };
  vm.createContext(context);
  vm.runInContext(source,context,{filename:'sw.js'});
  return {
    calls,stores,timers,
    async lifecycle(name) {
      let pending;
      handlers[name]({waitUntil:promise=>{pending=promise;}});
      await pending;
    },
    message(data) { handlers.message({data}); },
    request(url,{method='GET',mode='cors'}={}) {
      let promise;
      handlers.fetch({request:{url,method,mode},respondWith:result=>{promise=result;}});
      return promise;
    },
    fireTimeouts() { for (const {fn} of [...timers.values()]) fn(); }
  };
}

test('installed app and share target stay inside GitHub Pages subdirectory, with real correctly sized icons',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
  assert.equal(new URL(manifest.scope,scope).href,scope);
  assert.equal(new URL(manifest.start_url,scope).href,scope+'#/');
  assert.equal(manifest.display,'standalone');
  assert.equal(new URL(manifest.share_target.action,scope).href,scope);
  assert.equal(manifest.share_target.method,'GET');
  assert.deepEqual(manifest.share_target.params,{title:'share_title',text:'share_text',url:'share_url'});
  for (const icon of manifest.icons) {
    const url=new URL(icon.src,scope);
    assert(url.href.startsWith(scope));
    const png=fs.readFileSync(path.join(root,url.href.slice(scope.length)));
    assert.equal(png.subarray(1,4).toString(),'PNG');
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`,icon.sizes);
  }
  for (const shortcut of manifest.shortcuts || []) assert(new URL(shortcut.url,scope).href.startsWith(scope));
});

test('installation caches required local assets and leaves the current app running until update is accepted',async()=>{
  const w=workerFixture();
  await w.lifecycle('install');
  assert(w.calls.precache.includes(scope+'offline.html'));
  assert(w.calls.precache.includes(scope+'easy.css'));
  assert(w.calls.precache.includes(scope+'product-tools.js'));
  assert(w.calls.precache.includes(scope+'pwa.js'));
  assert.equal(w.calls.skipWaiting,0);
  w.message({type:'unrelated'});
  assert.equal(w.calls.skipWaiting,0);
  w.message({type:'SKIP_WAITING'});
  assert.equal(w.calls.skipWaiting,1);
});

test('does not intercept or cache Firebase, authentication, preview APIs, photos or unknown local paths',async()=>{
  const w=workerFixture();
  await w.lifecycle('install');
  const untouched=[
    'https://gahepatama-4707c-default-rtdb.firebaseio.com/private.json',
    'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js',
    'https://api.microlink.io/?url=https%3A%2F%2Fs.shopee.com.br%2Fabc',
    'https://down-br.img.susercontent.com/file/product-photo',
    scope+'api/account',scope+'__auth/handler',scope+'products.json',
    'https://perabru.github.io/another-app/styles.css'
  ];
  for (const url of untouched) assert.equal(w.request(url),undefined,url);
  assert.equal(w.request(scope+'app.js',{method:'POST'}),undefined);
  assert.equal(w.calls.fetch.length,0);
  assert.equal(w.calls.put.length,0);
  assert.equal(await (await w.request(scope+'easy.css')).text(),'network');
  assert.deepEqual(w.calls.put,[scope+'easy.css'],'only known static assets enter runtime cache');
});

test('navigation stays fresh online and uses an explicit offline page without caching shared links',async()=>{
  let offline=false;
  const w=workerFixture({fetchResponse:async()=>{
    if(offline) throw new TypeError('offline');
    return basicResponse('current-site');
  }});
  await w.lifecycle('install');
  const url=scope+'?share_url=https%3A%2F%2Fs.shopee.com.br%2Fprivate-affiliate-code';
  assert.equal(await (await w.request(url,{mode:'navigate'})).text(),'current-site');
  offline=true;
  const page=await (await w.request(url,{mode:'navigate'})).text();
  assert.match(page,/Vamos reconectar/);
  assert.match(page,/precisam de internet/);
  assert(!page.includes('private-affiliate-code'));
  assert.equal(w.calls.put.length,0,'navigation including share parameters never enters cache');
  assert.equal(w.timers.size,0);
});

test('a stalled navigation aborts after a bounded timeout and offers retry instead of hanging',async()=>{
  let signal;
  const w=workerFixture({fetchResponse:request=>{signal=request.signal;return new Promise(()=>{});}});
  await w.lifecycle('install');
  const pending=w.request(scope,{mode:'navigate'});
  assert.equal(w.timers.size,1);
  for (const {ms} of w.timers.values()) assert(ms>0 && ms<=15000,'navigation timeout is bounded');
  w.fireTimeouts();
  const page=await (await pending).text();
  assert.equal(signal.aborted,true);
  assert.match(page,/Tentar novamente/);
  assert.equal(w.timers.size,0);
});

test('temporary server failure offers offline retry while ordinary 404 responses remain intact',async()=>{
  let status=503;
  const w=workerFixture({fetchResponse:async()=>basicResponse('server-response',status)});
  await w.lifecycle('install');
  assert.match(await (await w.request(scope,{mode:'navigate'})).text(),/Vamos reconectar/);
  status=404;
  const response=await w.request(scope+'not-found',{mode:'navigate'});
  assert.equal(response.status,404);
  assert.equal(await response.text(),'server-response');
});

test('activation removes only older caches owned by this scoped app',async()=>{
  const w=workerFixture();
  const old='vitrine-livre-'+scope+'-older';
  const otherApp='vitrine-livre-https://perabru.github.io/another-app/-older';
  w.stores.set(old,new Map());
  w.stores.set(otherApp,new Map());
  w.stores.set('unrelated-cache',new Map());
  await w.lifecycle('install');
  const active=[...w.stores.keys()].find(name=>!['unrelated-cache',old,otherApp].includes(name));
  await w.lifecycle('activate');
  assert.deepEqual(w.calls.deleted,[old]);
  assert(w.stores.has(active));
  assert(w.stores.has(otherApp));
  assert(w.stores.has('unrelated-cache'));
  assert.equal(w.calls.claim,1);
});
