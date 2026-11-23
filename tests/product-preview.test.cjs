'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').replace(/^import\s+.*?;\s*$/gm,'');
function create({body,status=200}={}){
 const calls=[];
 const getEl=()=>({innerHTML:'',textContent:'',querySelectorAll(){return [];},addEventListener(){}});
 const ctx={
  URL,AbortController,console,Intl,Date,Math,Number,String,encodeURIComponent,
  initializeApp:()=>({}),getAuth:()=>({}),getDatabase:()=>({}),getFunctions:()=>({}),
  onAuthStateChanged:()=>{},get:async()=>({val:()=>null,exists:()=>false}),ref:()=>({}),query:()=>({}),limitToLast:()=>({}),
  GoogleAuthProvider:class{},signInWithPopup:async()=>{},signOut:async()=>{},
  set:async()=>{},update:async()=>{},remove:async()=>{},push:()=>({}),httpsCallable:()=>async()=>{},
  document:{getElementById:getEl,addEventListener(){}},window:{addEventListener(){}},
  location:{hash:'#/adicionar',href:'https://perabru.github.io/shopee-panel/'},navigator:{},
  setTimeout:()=>0,clearTimeout:()=>{},
  fetch:async (url)=>{calls.push(url);return {ok:status===200,status,json:async()=>body};}
 };
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(__dirname,'../product-page.js'),'utf8'),ctx,{filename:'product-page.js'});vm.runInContext(fs.readFileSync(path.join(__dirname,'../product-tools.js'),'utf8'),ctx,{filename:'product-tools.js'});vm.runInContext(source,ctx,{filename:'app.js'});
 return {ctx,calls};
}
test('título sugerido pelo link longo; links curtos não fabricam nomes',()=>{
 const {ctx}=create();
 assert.equal(vm.runInContext("guessNameFromLink('https://shopee.com.br/fone-bluetooth-sem-fio-i.12345.67890')",ctx),'fone bluetooth sem fio');
 assert.equal(vm.runInContext("guessNameFromLink('https://s.shopee.com.br/3Vab978')",ctx),'');
 assert.equal(vm.runInContext("guessNameFromLink('https://evil.example/tenis-nike')",ctx),'');
});
test('metadados públicos preenchem imagem e nome, sem modificar URL afiliada',async()=>{
 const {ctx,calls}=create({body:{status:'success',data:{title:'Fone Bluetooth Pro | Shopee Brasil',image:{url:'https://down-br.img.susercontent.com/file/photo123'}}}});
 const data=await vm.runInContext("lookupProductPreview('https://s.shopee.com.br/abc')",ctx);
 assert.equal(data.name,'Fone Bluetooth Pro');
 assert.equal(data.image,'https://down-br.img.susercontent.com/file/photo123');
 assert.ok(data.source,'a origem dos dados deve acompanhar a prévia');
 assert.equal(calls.length,1);
 assert.equal(new URL(calls[0]).searchParams.get('url'),'https://s.shopee.com.br/abc');
 await vm.runInContext("lookupProductPreview('https://s.shopee.com.br/abc')",ctx);
 assert.equal(calls.length,1,'cached success stops excessive preview calls');
});
test('falha ao ler a imagem mantém cadastro possível; URL maliciosa não é enviada',async()=>{
 const {ctx,calls}=create({body:{status:'fail',code:'EPROXYNEEDED'}});
 await assert.rejects(vm.runInContext("lookupProductPreview('https://s.shopee.com.br/link')",ctx),/não liberou/);
 await assert.rejects(vm.runInContext("lookupProductPreview('https://shopee.com.br.evil.example/photo')",ctx),/link|Shopee/i);
 assert.equal(calls.length,1);
});
test('compartilhamento aponta para vitrine pública com UID e WhatsApp',()=>{
 const {ctx}=create();
 const html=vm.runInContext("shareButtons('aff123456','Loja de Teste')",ctx);
 assert.match(html,/https:\/\/wa\.me\/\?text=/);
 assert.match(html,/#\/loja\/aff123456/);
 assert.match(html,/share-shop/);
});
test('API opcional busca item ID de URLs Shopee e rejeita IDs inválidos',()=>{
 const c=require('../functions/affiliate-core');
 assert.deepEqual(c.productIdsFromUrl('https://shopee.com.br/fone-sem-fio-i.123456.987654'),{shopId:'123456',itemId:'987654'});
 assert.deepEqual(c.productIdsFromUrl('https://shopee.com.br/product/123/456'),{shopId:'123',itemId:'456'});
 assert.deepEqual(c.productIdsFromUrl('https://shopee.com.br/qualquer?shopid=987&itemid=654'),{shopId:'987',itemId:'654'});
 assert.equal(c.productIdsFromUrl('https://s.shopee.com.br/abc'),null);
 assert.match(c.queryOfferByItemId('987654'),/productOfferV2\(itemId:987654/);
 assert.throws(()=>c.queryOfferByItemId('1) { secrets'),/inválido/);
});
function productForm(url){
 const fields={affiliateUrl:{value:url,dataset:{}},originalUrl:{value:'',dataset:{}},name:{value:'',dataset:{}},image:{value:'',dataset:{}},price:{value:'',dataset:{}},description:{value:'',dataset:{}},category:{value:'Outros',dataset:{}}};
 const status={textContent:'',dataset:{}},help={hidden:true},priceNote={textContent:'',hidden:true},chips={innerHTML:''};
 return {elements:fields,isConnected:true,dataset:{},status,help,priceNote,chips,querySelector(selector){
  const match=selector.match(/^\[name="(.+)"\]$/);if(match)return fields[match[1]]||null;
  if(selector==='[data-preview-status]')return status;
  if(selector==='[data-photo-help]')return help;
  if(selector==='[data-price-note]')return priceNote;
  if(selector==='[data-import-fields]')return chips;
  return null;
 }};
}

test('prévia respeita nome, foto, preço e descrição digitados pelo usuário',()=>{
 const {ctx}=create();ctx.form=productForm('https://s.shopee.com.br/abc');
 for(const [key,value] of Object.entries({name:'Meu nome',image:'https://example.com/manual.jpg',price:'15,90',description:'Minha descrição revisada'}))ctx.form.elements[key]={value,dataset:{autofilled:'0'}};
 vm.runInContext("fillProductPreview(form,{name:'Título remoto',image:'https://example.com/remote.jpg',price:29.99,description:'Descrição remota'})",ctx);
 assert.equal(ctx.form.elements.name.value,'Meu nome');
 assert.equal(ctx.form.elements.image.value,'https://example.com/manual.jpg');
 assert.equal(ctx.form.elements.price.value,'15,90');
 assert.equal(ctx.form.elements.description.value,'Minha descrição revisada');
});

test('resposta atrasada do link anterior não substitui dados do produto atual',async()=>{
 const {ctx}=create();const requests=new Map();
 ctx.lookupStub=url=>new Promise(resolve=>requests.set(url,resolve));
 vm.runInContext('publicPreviewLookup=lookupStub',ctx);
 ctx.form=productForm('https://s.shopee.com.br/primeiro');
 vm.runInContext('previewSequence=1',ctx);
 const first=vm.runInContext("resolveProductPreview(form,'https://s.shopee.com.br/primeiro',1)",ctx);
 ctx.form.elements.affiliateUrl.value='https://s.shopee.com.br/segundo';
 vm.runInContext('previewSequence=2',ctx);
 const second=vm.runInContext("resolveProductPreview(form,'https://s.shopee.com.br/segundo',2)",ctx);
 requests.get('https://s.shopee.com.br/segundo')({name:'Segundo produto',image:'https://example.com/second.jpg',price:49.9,description:'Descrição do segundo produto',source:'página do produto'});
 await second;
 requests.get('https://s.shopee.com.br/primeiro')({name:'Primeiro produto',image:'https://example.com/first.jpg',price:99.9,description:'Descrição do primeiro produto',source:'página do produto'});
 await first;
 assert.equal(ctx.form.elements.name.value,'Segundo produto');
 assert.equal(ctx.form.elements.image.value,'https://example.com/second.jpg');
 assert.equal(ctx.form.elements.price.value,'49,90');
 assert.equal(ctx.form.elements.description.value,'Descrição do segundo produto');
 assert.equal(ctx.form.status.dataset.status,'success');
});

test('link original é usado somente para foto, sem substituir o afiliado',()=>{
 const {ctx}=create();ctx.form=productForm('Oferta\nhttps://s.shopee.com.br/abc?subid=meu');
 ctx.form.elements.originalUrl.value='https://shopee.com.br/fone-i.123.456';
 assert.equal(vm.runInContext('previewLink(form)',ctx),'https://shopee.com.br/fone-i.123.456');
 vm.runInContext("fillProductPreview(form,{name:'Fone de ouvido',image:'https://example.com/photo.jpg'})",ctx);
 assert.equal(ctx.form.elements.affiliateUrl.value,'Oferta\nhttps://s.shopee.com.br/abc?subid=meu');
});

test('prévia não restaura campos que o usuário apagou manualmente',()=>{
 const {ctx}=create();ctx.form=productForm('https://s.shopee.com.br/abc');
 for(const key of ['name','image','price','description'])ctx.form.elements[key]={value:'',dataset:{autofilled:'0'}};
 vm.runInContext("fillProductPreview(form,{name:'Título remoto',image:'https://example.com/remote.jpg',price:29.99,description:'Descrição remota'})",ctx);
 for(const key of ['name','image','price','description'])assert.equal(ctx.form.elements[key].value,'',key+' deve permanecer vazio');
});

test('prévia recebida após sair do formulário não preenche a tela abandonada',async()=>{
 const {ctx}=create();let respond;
 ctx.fetch=()=>new Promise(resolve=>{respond=resolve;});
 ctx.form=productForm('https://s.shopee.com.br/abc');
 vm.runInContext('previewSequence=1',ctx);
 const pending=vm.runInContext("resolveProductPreview(form,'https://s.shopee.com.br/abc',1)",ctx);
 ctx.form.isConnected=false;
 respond({ok:true,status:200,json:async()=>({status:'success',data:{title:'Resultado atrasado',image:{url:'https://example.com/late.jpg'}}})});
 await pending;
 assert.equal(ctx.form.elements.name.value,'');
 assert.equal(ctx.form.elements.image.value,'');
});


test('a leitura completa preenche os quatro campos, mostra sucesso e preserva o afiliado',async()=>{
 const {ctx}=create();
 const affiliate='https://s.shopee.com.br/exato?subid=meu%2Flink';
 ctx.form=productForm(affiliate);
 ctx.remote={name:'Cafeteira elétrica',image:'https://example.com/cafeteira.jpg',images:['https://example.com/cafeteira.jpg'],price:1299.9,description:'Cafeteira elétrica com filtro reutilizável.',priceNote:'Preço confirmado na página.',source:'página do produto',canonicalUrl:'https://shopee.com.br/product/123/456'};
 vm.runInContext('publicPreviewLookup=async()=>remote;previewSequence=4',ctx);
 await vm.runInContext('resolveProductPreview(form,form.elements.affiliateUrl.value,4)',ctx);
 assert.equal(ctx.form.elements.name.value,'Cafeteira elétrica');
 assert.equal(ctx.form.elements.image.value,'https://example.com/cafeteira.jpg');
 assert.equal(ctx.form.elements.price.value,'1299,90');
 assert.equal(ctx.form.elements.description.value,'Cafeteira elétrica com filtro reutilizável.');
 assert.equal(ctx.form.elements.affiliateUrl.value,affiliate);
 assert.equal(ctx.form.status.dataset.status,'success');
 assert.match(ctx.form.status.textContent,/Nome, foto, preço e descrição preenchidos/);
 assert.equal((ctx.form.chips.innerHTML.match(/data-ready="true"/g)||[]).length,4);
 assert.equal(ctx.form.priceNote.textContent,'Preço confirmado na página.');
});

test('preço vazio não vira zero, mas um zero explícito é preservado',()=>{
 const {ctx}=create();ctx.form=productForm('https://s.shopee.com.br/abc');
 for(const price of ['', ' ', null, undefined]){
  ctx.remote={price};
  vm.runInContext('fillProductPreview(form,remote)',ctx);
  assert.equal(ctx.form.elements.price.value,'');
  assert.equal(vm.runInContext('productFieldStatus(form).find(f=>f.name==="Preço").ready',ctx),false);
 }
 vm.runInContext('fillProductPreview(form,{price:0})',ctx);
 assert.equal(ctx.form.elements.price.value,'0,00');
 assert.equal(vm.runInContext('productFieldStatus(form).find(f=>f.name==="Preço").ready',ctx),true);
});

test('resultado parcial informa exatamente os campos ainda não preenchidos',async()=>{
 const {ctx}=create();ctx.form=productForm('https://s.shopee.com.br/parcial');
 vm.runInContext("publicPreviewLookup=async()=>({name:'Produto parcial',image:'https://example.com/photo.jpg'});previewSequence=2",ctx);
 await vm.runInContext("resolveProductPreview(form,'https://s.shopee.com.br/parcial',2)",ctx);
 assert.equal(ctx.form.status.dataset.status,'warning');
 assert.match(ctx.form.status.textContent,/Não foi possível preencher: preço, descrição/);
 assert.equal((ctx.form.chips.innerHTML.match(/data-ready="true"/g)||[]).length,2);
});

test('trocar URL limpa a descrição automática, mantendo uma descrição editada',()=>{
 const {ctx}=create();ctx.form=productForm('https://s.shopee.com.br/novo');
 ctx.form.dataset.previewUrl='https://s.shopee.com.br/antigo';
 ctx.form.elements.description={value:'Texto do produto antigo',dataset:{autofilled:'1'}};
 vm.runInContext('scheduleProductPreview(form)',ctx);
 assert.equal(ctx.form.elements.description.value,'');
 ctx.form.dataset.previewUrl='https://s.shopee.com.br/antigo';
 ctx.form.elements.description={value:'Texto que editei',dataset:{autofilled:'0'}};
 vm.runInContext('scheduleProductPreview(form)',ctx);
 assert.equal(ctx.form.elements.description.value,'Texto que editei');
});
