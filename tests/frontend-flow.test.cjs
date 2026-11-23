'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

function initialize(){
 const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').replace(/^import\s+.*?;\s*$/gm,'');
 const values={}; let idx=0;
 const keys=p=>String(p||'').split('/').filter(Boolean);
 function lookup(p){return keys(p).reduce((x,k)=>x?.[k],values);}
 function assign(p,v){const parts=keys(p);let x=values;for(const k of parts.slice(0,-1))x=x[k]||(x[k]={});if(v===null)delete x[parts.at(-1)];else x[parts.at(-1)]=structuredClone(v);}
 const elements=new Map();
 const getId=id=>{if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',className:'',querySelectorAll(){return[];},addEventListener(){}});return elements.get(id);};
 const global={
  URL,console,Date,Number,String,Math,Intl,encodeURIComponent,decodeURIComponent,
  initializeApp:()=>({}),getAuth:()=>({}),getDatabase:()=>({}),getFunctions:()=>({}),
  GoogleAuthProvider:class{},signInWithPopup:async()=>{},signOut:async()=>{},onAuthStateChanged:()=>{},
  ref:(db,p='')=>({path:p}),get:async r=>({exists:()=>lookup(r.path)!=null,val:()=>lookup(r.path)??null}),
  set:async(r,v)=>assign(r.path,v),update:async(r,patch)=>{for(const [p,v] of Object.entries(patch))assign([r.path,p].filter(Boolean).join('/'),v);},
  remove:async r=>assign(r.path,null),push:r=>({path:r.path+'/-PROD'+(++idx),key:'-PROD'+idx}),
  query:r=>r,limitToLast:()=>{},httpsCallable:()=>async()=>{throw Error('Functions indisponíveis');},
  document:{getElementById:getId,addEventListener(){}},window:{addEventListener(){}},
  location:{hash:'#/painel',href:'https://perabru.github.io/shopee-panel/'},
  setTimeout:()=>0,clearTimeout:()=>{},confirm:()=>true,navigator:{clipboard:{writeText:async()=>{}}}
 };
 const context=vm.createContext(global);
 vm.runInContext(source,context,{filename:'app.js'});
 return {context,values,elements};
}
test('login autenticado cria vitrine em RTDB, produto manual e vitrine pública',async()=>{
 const {context,values}=initialize();
 vm.runInContext("state.user={uid:'u_test123456',displayName:'Professor Pera'}; state.authReady=true; state.route='painel';",context);
 await vm.runInContext('refreshOwn()',context);
 assert.equal(values.shopeePanel.v1.shops.u_test123456.name,'Vitrine de Professor');
 assert.equal(values.shopeePanel.v1.publicShops.u_test123456.isPublic,true);
 assert.equal(values.shopeePanel.v1.affiliateSecrets,undefined);
 await vm.runInContext("saveManualProduct({name:'Controle PS5',description:'Produto original',originalUrl:'https://shopee.com.br/controle-ps5',affiliateUrl:'https://s.shopee.com.br/afiliado-ok',image:'',price:'249.90',category:'Games'})",context);
 await vm.runInContext('refreshOwn()',context);
 await vm.runInContext('fetchPublicShops()',context);
 await vm.runInContext("fetchStore('u_test123456')",context);
 assert.equal(vm.runInContext('state.myProducts.length',context),1);
 assert.equal(vm.runInContext('state.publicProducts.length',context),1);
 assert.equal(vm.runInContext('state.shops.length',context),1);
 assert.equal(values.shopeePanel.v1.publicProducts.u_test123456['-PROD1'].affiliateUrl,'https://s.shopee.com.br/afiliado-ok');
 assert.equal(vm.runInContext('state.connected',context),false);
 await vm.runInContext("remove(dbRef('publicProducts/u_test123456/-PROD1'))",context);
 await vm.runInContext('refreshOwn()',context);
 assert.equal(vm.runInContext('state.myProducts.length',context),0);
});

test('links que não são Shopee não podem ser publicados',async()=>{
 const {context}=initialize();
 vm.runInContext("state.user={uid:'u_test123456',displayName:'Professor Pera'}; state.authReady=true;",context);
 await vm.runInContext('refreshOwn()',context);
 await assert.rejects(vm.runInContext("saveManualProduct({name:'Fraude',originalUrl:'https://shopee.com.br/item',affiliateUrl:'https://example.com/enganoso'})",context),/link de afiliado/);
});

test('vitrine privada deixa de aparecer no catálogo público',async()=>{
 const {context,values}=initialize();
 vm.runInContext("state.user={uid:'u_test123456',displayName:'Professor Pera'}; state.authReady=true;",context);
 await vm.runInContext('refreshOwn()',context);
 await vm.runInContext("saveStoreData({...state.shop,isPublic:false,updatedAt:Date.now()})",context);
 assert.equal(values.shopeePanel.v1.publicShops.u_test123456,undefined);
 await vm.runInContext('fetchPublicShops()',context);
 assert.equal(vm.runInContext('state.shops.length',context),0);
});