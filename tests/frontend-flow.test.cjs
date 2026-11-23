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
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../product-tools.js'),'utf8'),context,{filename:'product-tools.js'});
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
test('mensagem compartilhada salva link afiliado intacto, preço brasileiro e referência separada',async()=>{
 const {context,values}=initialize();
 vm.runInContext("state.user={uid:'u_test123456',displayName:'Teste'};state.authReady=true;",context);
 await vm.runInContext('refreshOwn()',context);
 context.offer={name:'Cafeteira',affiliateUrl:'Confira esta oferta!\nhttps://s.shopee.com.br/Oferta123?af_id=AbC%2F123&sub_id=casa\nPor R$ 1.299,90',originalUrl:'https://shopee.com.br/cafeteira-i.123.456',price:'R$ 1.299,90',category:'Casa',image:''};
 await vm.runInContext('saveManualProduct(offer)',context);
 const saved=values.shopeePanel.v1.publicProducts.u_test123456['-PROD1'];
 assert.equal(saved.affiliateUrl,'https://s.shopee.com.br/Oferta123?af_id=AbC%2F123&sub_id=casa');
 assert.equal(saved.originalUrl,'https://shopee.com.br/cafeteira-i.123.456');
 assert.equal(saved.price,1299.9);
 assert.equal(saved.trackingSource,'manual');
});

test('editar altera o mesmo registro, preserva criação e permite remover preço',async()=>{
 const {context,values}=initialize();
 vm.runInContext("state.user={uid:'u_test123456',displayName:'Teste'};state.authReady=true;",context);
 await vm.runInContext('refreshOwn()',context);
 context.offer={name:'Nome antigo',affiliateUrl:'https://s.shopee.com.br/Oferta123',price:'89,90',category:'Casa',image:''};
 const id=await vm.runInContext('saveManualProduct(offer)',context);
 await vm.runInContext('refreshOwn()',context);
 const original=structuredClone(values.shopeePanel.v1.publicProducts.u_test123456[id]);
 context.edit={...context.offer,editId:id,name:'Nome corrigido',price:'',image:'https://down-br.img.susercontent.com/file/new-photo'};
 assert.equal(await vm.runInContext('saveManualProduct(edit)',context),id);
 const records=values.shopeePanel.v1.publicProducts.u_test123456;
 assert.equal(Object.keys(records).length,1);
 assert.equal(records[id].name,'Nome corrigido');
 assert.equal(records[id].createdAt,original.createdAt);
 assert.equal(records[id].trackingSource,original.trackingSource);
 assert.equal(records[id].affiliateUrl,original.affiliateUrl);
 assert.equal(records[id].price,undefined);
});

test('link duplicado e preço inválido não criam registros extras',async()=>{
 const {context,values}=initialize();
 vm.runInContext("state.user={uid:'u_test123456',displayName:'Teste'};state.authReady=true;",context);
 await vm.runInContext('refreshOwn()',context);
 context.offer={name:'Oferta',affiliateUrl:'https://s.shopee.com.br/Oferta123',price:'59,90',image:''};
 await vm.runInContext('saveManualProduct(offer)',context);
 await vm.runInContext('refreshOwn()',context);
 await assert.rejects(vm.runInContext('saveManualProduct(offer)',context),/já está/);
 await assert.rejects(vm.runInContext("saveManualProduct({...offer,affiliateUrl:'https://s.shopee.com.br/Outra123',price:'1,2,3'})",context),/Preço inválido/);
 assert.equal(Object.keys(values.shopeePanel.v1.publicProducts.u_test123456).length,1);
});

test('compartilhamento individual contém nome, preço e link exato uma única vez',()=>{
 const {context}=initialize();
 context.offer={name:'Cafeteira',affiliateUrl:'https://s.shopee.com.br/Oferta123?af_id=AbC%2F123',price:1299.9};
 const text=vm.runInContext('productShareText(offer)',context);
 assert.equal(text.split('\n').length,3);
 assert.match(text,/^Cafeteira\nR\$\s1\.299,90\n/);
 assert.ok(text.endsWith(context.offer.affiliateUrl));
 assert.equal(text.split(context.offer.affiliateUrl).length,2);
 assert.equal(vm.runInContext('productShareText({...offer,price:null})',context),'Cafeteira\n'+context.offer.affiliateUrl);
});

test('edição de produto da API falha antes de tentar alterar dados protegidos',async()=>{
 const {context,values}=initialize();
 vm.runInContext("state.user={uid:'u_test123456',displayName:'Teste'};state.authReady=true;",context);
 await vm.runInContext('refreshOwn()',context);
 const product={name:'Oferta API',affiliateUrl:'https://s.shopee.com.br/Api123',originalUrl:'https://shopee.com.br/item-i.123.456',price:199.9,category:'Games',image:'',description:'',trackingSource:'api',published:true,createdAt:123456};
 values.shopeePanel.v1.publicProducts={u_test123456:{'-API1':structuredClone(product)}};
 await vm.runInContext('refreshOwn()',context);
 context.edit={...product,editId:'-API1',name:'Alteração indevida'};
 await assert.rejects(vm.runInContext('saveManualProduct(edit)',context),/API|integração/i);
 assert.deepEqual(values.shopeePanel.v1.publicProducts.u_test123456['-API1'],product);
 const card=vm.runInContext("productCard(state.myProducts[0],true)",context);
 assert.ok(!card.includes('data-action="edit-product"'));
 assert.ok(card.includes('data-action="share-product"'));
});
