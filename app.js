import {initializeApp} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import {getDatabase,ref,get,set,update,remove,push,query,limitToLast} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-database.js';
import {getFunctions,httpsCallable} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-functions.js';

const firebaseConfig={
 apiKey:'AIzaSyA1dsuvCYdG3dwGKESqRGk5BYn5kEbHN7c',
 authDomain:'gahepatama-4707c.firebaseapp.com',
 databaseURL:'https://gahepatama-4707c-default-rtdb.firebaseio.com',
 projectId:'gahepatama-4707c',
 storageBucket:'gahepatama-4707c.firebasestorage.app',
 messagingSenderId:'330984382062',
 appId:'1:330984382062:web:3000a47a3ce6ef62d8907f'
};
const fb=initializeApp(firebaseConfig);
const auth=getAuth(fb);
const db=getDatabase(fb);
// Nomespacing evita misturar dados de outros sistemas neste mesmo Realtime Database.
function dbRef(path=''){return ref(db,'shopeePanel/v1'+(path?'/'+path:''));}
const functions=getFunctions(fb,'southamerica-east1');
const app=document.getElementById('app');
const $=(id)=>document.getElementById(id);
const categories=['Tudo','Casa','Eletrônicos','Moda','Beleza','Esportes','Games','Acessórios','Lojas','Outros'];
const state={user:null,authReady:false,shop:null,connected:false,shops:[],myProducts:[],publicShop:null,publicProducts:[],offers:[],offerQuery:'',offerPage:1,offerNext:false,report:null,reportError:'',route:'home',routeId:'',loading:false,loadingOffers:false,loadingStore:false,publicError:'',ownerError:'',homeQuery:'',storeQuery:'',category:'Tudo'};
let loadingNonce=0;
let toastTimer;

function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
const h=escapeHtml;
function money(value){return value==null?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0);}
function formattedDate(value){return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(value);}
function short(value){return String(value||'').length>80?String(value).slice(0,77)+'…':String(value||'');}
function validShopee(url){try{const u=new URL(url);return u.protocol==='https:'&&/(^|\.)(shopee\.com\.br|shopee\.com|shp\.ee|shope\.ee)$/i.test(u.hostname)&&!u.port&&!u.username;}catch{return false;}}
function safeImage(url){try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.port?u.href:'';}catch{return '';}}
function toast(message,isError=false){const el=$('toast');el.textContent=String(message);el.className='toast show'+(isError?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.className='toast';},5200);}
function errText(error){
 const code=String(error?.code||'').toLowerCase();
 if(code.includes('permission-denied')||code.includes('permission_denied'))return 'Sem permissão no Realtime Database. Publique as regras database.rules.json do projeto no console do Firebase.';
 if(code.includes('unauthorized-domain'))return 'Autorize perabru.github.io em Firebase Authentication → Configurações → Domínios autorizados.';
 if(code.includes('operation-not-allowed'))return 'Habilite o provedor Google no Firebase Authentication.';
 if(code.includes('network')||code.includes('disconnected'))return 'Sem conexão com o Firebase. Verifique sua internet e tente novamente.';
 if(code.includes('functions/not-found')||code.includes('functions/unavailable')||code.includes('functions/internal'))return 'A automação da API Shopee não está disponível neste Firebase. Você pode publicar normalmente usando um link de afiliado já criado na Shopee.';
 const str=String(error?.message||error||'Erro inesperado.');
 return str.replace(/^(FirebaseError:\s*)?(functions\/[\w-]+:\s*)+/i,'').replace(/\s*internal\s*\[0\]/ig,'').slice(0,280);
}
async function call(name,data={}){
 try{const r=await httpsCallable(functions,name,{timeout:45000})(data);return r.data;}
 catch(error){if(['functions/not-found','functions/unavailable','functions/internal','functions/deadline-exceeded'].includes(error?.code))throw new Error('A API Shopee ainda não está ativa no backend. A vitrine e os links manuais funcionam pelo Realtime Database; a automação exige implantação das Cloud Functions.');throw error;}
}
function uidPath(uid){if(!/^[A-Za-z0-9_-]{6,160}$/.test(String(uid||'')))throw new Error('Identificador da conta inválido.');return uid;}
function shopPublicData(s){return {ownerUid:s.ownerUid,name:s.name,description:s.description||'',slug:s.slug||'',referenceUrl:s.referenceUrl||'',isPublic:true,productCount:Math.max(0,Number(s.productCount)||0),createdAt:s.createdAt,updatedAt:s.updatedAt};}
function displayNameOf(user){return String(user?.displayName||'Minha').trim().slice(0,60)||'Minha';}
function safeText(value,max=180){return String(value||'').replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,max);}
async function saveStoreData(shop){
 const uid=uidPath(state.user.uid);
 const updates={['shops/'+uid]:shop,['publicShops/'+uid]:shop.isPublic?shopPublicData(shop):null};
 await update(dbRef(),updates);state.shop=shop;
}
async function updateCounts(uid,count){
 if(!state.shop)return;
 try{
  const base={['shops/'+uid+'/productCount']:count};
  if(state.shop.isPublic)base['publicShops/'+uid+'/productCount']=count;
  await update(dbRef(),base);state.shop.productCount=count;
 }catch(error){console.warn('Não foi possível atualizar a contagem:',errText(error));}
}
async function saveManualProduct(input){
 if(!state.user)throw new Error('Entre com Google para publicar.');
 const uid=uidPath(state.user.uid);
 const name=safeText(input.name,180),description=safeText(input.description,350);
 if(!name)throw new Error('Informe o nome do produto.');
 const affiliateUrl=String(input.affiliateUrl||'').trim();
 // Se não houver link original, use o link afiliado como referência.
 const originalUrl=String(input.originalUrl||affiliateUrl).trim();
 if(!validShopee(originalUrl))throw new Error('Informe um link HTTPS válido da Shopee.');
 if(!validShopee(affiliateUrl))throw new Error('Informe seu link de afiliado já gerado na Shopee. Não é possível gerar atribuição por um link comum.');
 const image=String(input.image||'').trim();
 if(image&&!safeImage(image))throw new Error('A URL da imagem deve usar HTTPS.');
 const priceText=String(input.price||'').trim();
 const price=priceText?Number(priceText):null;
 if(price!==null&&(!Number.isFinite(price)||price<0||price>1e8))throw new Error('Preço inválido.');
 const category=categories.includes(input.category)?input.category:'Outros';
 const doc={name,description,originalUrl,affiliateUrl,image,category,trackingSource:'manual',published:true,createdAt:Date.now()};
 if(price!==null)doc.price=Math.round(price*100)/100;
 const node=push(dbRef('publicProducts/'+uid));
 await set(node,doc);
 return node.key;
}

// Descoberta de prévia: a Shopee pode bloquear prévias externas. Nunca inventamos imagens.
const previewCache=new Map();
let previewTimer=null;
let previewSequence=0;
function guessNameFromLink(link){
 if(!validShopee(link))return '';
 try{
  const url=new URL(link);
  let slug=decodeURIComponent(url.pathname.split('/').filter(Boolean).pop()||'');
  slug=slug.replace(/-i\.\d+\.\d+$/i,'').replace(/^product$/i,'');
  if(!slug||/^\d+$/.test(slug)||/^(?:[a-z0-9]{1,12})$/i.test(slug)&&!slug.includes('-'))return '';
  const words=slug.replace(/[-_]+/g,' ').replace(/[.]+/g,' ').replace(/\s+/g,' ').trim();
  return words.length>8?safeText(words,180):'';
 }catch{return '';}
}
function previewTitle(value){
 const title=safeText(value,180).replace(/\s*([|–-])\s*Shopee(?: Brasil)?\s*$/i,'').trim();
 if(!title||/^(Shopee|Login|Página não encontrada|Just a moment|Access denied)$/i.test(title))return '';
 return title;
}
async function lookupProductPreview(link){
 if(!validShopee(link))throw new Error('Cole um endereço HTTPS válido da Shopee.');
 if(previewCache.has(link))return previewCache.get(link);
 if(state.connected){
  try{
   const result=await call('previewProduct',{url:link});
   const offer=result?.offer;
   if(offer&&(safeImage(offer.image)||previewTitle(offer.name))){
    const info={name:previewTitle(offer.name),image:safeImage(offer.image),price:offer.price,source:'API oficial Shopee'};
    previewCache.set(link,info);return info;
   }
  }catch(error){console.info('Prévia pela API indisponível:',errText(error));}
 }
 // Prévia pública opcional (serviço terceirizado, sem credenciais pessoais).
 // A Shopee pode bloquear este acesso e o serviço gratuito possui limite de uso.
 const endpoint=new URL('https://api.microlink.io/');
 endpoint.searchParams.set('url',link);
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),9500);
 try{
  const response=await fetch(endpoint.toString(),{headers:{'Accept':'application/json'},signal:controller.signal,referrerPolicy:'no-referrer'});
  if(!response.ok)throw new Error('Prévia não disponível.');
  const payload=await response.json();
  if(payload?.status!=='success'||!payload?.data)throw new Error('A página da Shopee não liberou seus dados.');
  const meta=payload.data;
  if(meta.url&&!validShopee(meta.url))throw new Error('O link redirecionou para uma página não reconhecida da Shopee.');
  const image=safeImage(typeof meta.image==='string'?meta.image:meta.image?.url);
  const name=previewTitle(meta.title);
  if(!image&&!name)throw new Error('A página não informou imagem ou título.');
  const info={name,image,source:'prévia pública do link'};
  previewCache.set(link,info);return info;
 }finally{clearTimeout(timeout);}
}
function fillProductPreview(form,info){
 const title=form.querySelector('[name="name"]');
 const image=form.querySelector('[name="image"]');
 const price=form.querySelector('[name="price"]');
 const suggested=info.name||guessNameFromLink(form.elements.affiliateUrl.value.trim());
 if(title&&suggested&&(!title.value||title.dataset.autofilled==='1')){
  title.value=suggested;title.dataset.autofilled='1';
 }
 if(image&&info.image&&(!image.value||image.dataset.autofilled==='1')){
  image.value=info.image;image.dataset.autofilled='1';
 }
 if(price&&info.price!=null&&!price.value&&Number.isFinite(Number(info.price))){price.value=Number(info.price).toFixed(2);price.dataset.autofilled='1';}
 renderPreviewCard(form,info.source);
}
function renderPreviewCard(form,source=''){
 const card=form.querySelector('[data-preview-card]');
 if(!card)return;
 const title=safeText(form.querySelector('[name="name"]')?.value,180);
 const image=safeImage(form.querySelector('[name="image"]')?.value);
 const category=String(form.querySelector('[name="category"]')?.value||'Outros');
 card.innerHTML=`<div class="mini-preview-image">${image?`<img src="${h(image)}" alt="Imagem encontrada do produto" loading="lazy" referrerpolicy="no-referrer">`:`<span aria-hidden="true">${categoryIcon(category)}</span>`}</div><div class="mini-preview-text"><span>PRÉVIA DA VITRINE ${source?'· '+h(source):''}</span><strong>${h(title||'Seu produto aparecerá aqui')}</strong><small>${image?'✓ Imagem encontrada — você pode alterá-la abaixo.':'A imagem aparece aqui assim que for encontrada.'}</small></div>`;
 const photo=card.querySelector('img');
 if(photo)photo.onerror=()=>{photo.remove();const ph=card.querySelector('.mini-preview-image');if(ph)ph.textContent='▣';};
}
async function resolveProductPreview(form,url,seq){
 const status=form.querySelector('[data-preview-status]');
 if(status){status.textContent='Buscando foto e título do produto…';status.dataset.status='loading';}
 try{
  const info=await lookupProductPreview(url);
  if(seq!==previewSequence||!form.isConnected||form.elements.affiliateUrl.value.trim()!==url)return;
  fillProductPreview(form,info);
  if(status){status.textContent=info.image?'Imagem encontrada! Revise e publique.':'Título encontrado; esta página não disponibilizou uma imagem.';status.dataset.status='success';}
 }catch(error){
  if(seq!==previewSequence||!form.isConnected||form.elements.affiliateUrl.value.trim()!==url)return;
  fillProductPreview(form,{name:guessNameFromLink(url),image:'',source:''});
  if(status){status.textContent='Não foi possível obter a imagem automaticamente. Você pode colar a URL da foto em “Ajustar detalhes”.';status.dataset.status='warning';}
 }
}
function scheduleProductPreview(form,immediate=false){
 clearTimeout(previewTimer);
 const seq=++previewSequence;
 const url=form.querySelector('[name="affiliateUrl"]')?.value.trim()||'';
 const status=form.querySelector('[data-preview-status]');
 if(form.dataset.previewUrl!==url){
  for(const name of ['name','image','price']){const input=form.querySelector('[name="'+name+'"]');if(input?.dataset.autofilled==='1'){input.value='';delete input.dataset.autofilled;}}
  form.dataset.previewUrl=url;renderPreviewCard(form);
 }
 if(!url){if(status){status.textContent='Cole um link para tentar encontrar a imagem automaticamente.';status.dataset.status='idle';}return;}
 if(!validShopee(url)){
  if(status){status.textContent='Use um link HTTPS válido da Shopee ou do encurtador oficial.';status.dataset.status='warning';}return;
 }
 fillProductPreview(form,{name:guessNameFromLink(url),image:'',source:''});
 previewTimer=setTimeout(()=>resolveProductPreview(form,url,seq),immediate?0:650);
}
function shareText(name,url){return `Olha essa seleção de produtos! 🛍️\n${name}\n${url}`;}
function shareButtons(uid,name){
 const url=shopUrl(uid),encoded=encodeURIComponent(shareText(name,url));
 return `<div class="share-buttons"><button class="btn btn-white btn-sm" type="button" data-action="copy" data-url="${h(url)}">⧉ Copiar link</button><a class="btn btn-share-whatsapp btn-sm" href="https://wa.me/?text=${encoded}" target="_blank" rel="noopener noreferrer">WhatsApp ↗</a><button class="btn btn-orange btn-sm" type="button" data-action="share-shop" data-url="${h(url)}" data-name="${h(name)}">↗ Compartilhar</button></div>`;
}
function currentPath(){return location.hash.replace(/^#\/?/,'')||'';}
function parseRoute(){const parts=currentPath().split('/').filter(Boolean);return {route:parts[0]||'home',id:parts[1]||''};}
function shopUrl(uid){return new URL('./#/loja/'+encodeURIComponent(uid),location.href.split('#')[0]).href;}
function initials(name){return String(name||'VL').split(' ').map(s=>s[0]).filter(Boolean).slice(0,2).join('').toUpperCase();}
function categoryIcon(cat){return ({'Casa':'🏠','Eletrônicos':'⌁','Moda':'◈','Beleza':'✿','Esportes':'◎','Games':'▣','Acessórios':'✦','Lojas':'▦','Outros':'▧'})[cat]||'◉';}
function alertBox(type,text){return `<div class="alert ${type}">${text}</div>`;}
function loading(message='Carregando...'){return `<div class="loading-screen"><span class="loader"></span><p>${h(message)}</p></div>`;}
function empty(icon,title,subtitle,action=''){return `<div class="empty"><div class="empty-icon">${icon}</div><h3>${h(title)}</h3><p>${h(subtitle)}</p>${action}</div>`;}
function productPhoto(p){const src=safeImage(p.image);return `<div class="product-photo"><div class="placeholder">${categoryIcon(p.category)}</div>${src?`<img src="${h(src)}" alt="${h(p.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:''}<span class="photo-label">Escolha especial</span></div>`;}
function productCard(p,admin=false){const link=validShopee(p.affiliateUrl)?p.affiliateUrl:'';const price=p.price!=null?`<div class="product-price">${money(p.price)}</div>`:`<div class="product-price muted">Consulte o preço na Shopee</div>`;return `<article class="product-card">${productPhoto(p)}<div class="product-card-body"><span class="pill orange" style="align-self:start;margin-bottom:9px">${h(p.category||'Outros')}</span><strong class="product-card-title">${h(p.name)}</strong><div class="product-card-meta">${h(p.description||'Oferta selecionada para esta vitrine.')}</div>${price}<div class="product-card-actions">${link?`<a href="${h(link)}" class="btn btn-orange btn-sm" target="_blank" rel="noopener noreferrer sponsored">Comprar na Shopee ↗</a>`:`<button class="btn btn-white btn-sm" disabled>Link indisponível</button>`}${admin?`<button class="btn btn-white btn-sm btn-icon" data-action="remove-product" data-id="${h(p.id)}" title="Excluir produto" aria-label="Excluir ${h(p.name)}">✕</button>`:''}</div><div class="product-note">Compra e pagamento finalizados na Shopee. Preço sujeito a alterações.</div></div></article>`;}
function offerCard(o,index){return `<article class="product-card">${productPhoto({...o,category:'Outros'})}<div class="product-card-body"><strong class="product-card-title">${h(o.name)}</strong><div class="product-card-meta">${h(o.shopName||'Loja Shopee')} ${o.rating?`· ★ ${h(o.rating.toFixed(1))}`:''}</div>${o.price!=null?`<div class="product-price">${money(o.price)}</div>`:'<div class="product-price muted">Preço na Shopee</div>'}<div style="margin-top:6px"><span class="pill green">Comissão anunciada: ${h((o.commissionRate*100).toFixed(1))}%</span></div><div class="product-card-actions"><button class="btn btn-orange btn-sm" data-action="publish-offer" data-index="${index}">+ Adicionar à minha vitrine</button></div><div class="product-note">Estimativa de comissão da oferta, não receita confirmada.</div></div></article>`;}
function renderTop(){const el=$('userActions');if(!state.authReady){el.innerHTML='<button class="btn btn-white btn-sm" disabled>Carregando...</button>';return;}if(!state.user){el.innerHTML='<button class="btn btn-orange" data-action="login"><span class="google-g" style="color:white;font-weight:800">G</span> Entrar com Google</button>';return;}const name=state.user.displayName||'Minha conta';el.innerHTML=`<div class="user-mini"><span class="avatar" title="${h(name)}">${h(initials(name))}</span><span class="username">${h(short(name.split(' ')[0]))}</span></div><a href="#/painel" class="btn btn-orange btn-sm">Meu painel</a>`;}

/** Local parser: a username link is not necessarily a numeric shop ID. No scraping or redirects. */
function detectShopFromLink(input){
 const url=String(input||'').trim();
 if(!validShopee(url))return {kind:'invalid',message:'Cole um link HTTPS oficial da Shopee (ex.: https://shopee.com.br/q63ifc2_ce).'};
 const u=new URL(url);
 const numeric=u.pathname.match(/^\/shop\/(\d{1,20})(?:\/|$)/i);
 if(numeric)return {kind:'id',id:numeric[1],message:'ID numérico identificado no caminho da loja.'};
 for(const [key,value] of u.searchParams){
  if(/^(shopid|shop_id)$/i.test(key)&&/^\d{1,20}$/.test(value))return {kind:'id',id:value,message:'ID numérico identificado nos parâmetros do link.'};
 }
 const product=u.pathname.match(/(?:^|[-/])i\.(\d{1,20})\.\d{1,20}(?:\/|$)/i);
 if(product)return {kind:'id',id:product[1],message:'Possível ID de loja identificado na URL do produto; confira na própria Shopee antes de usar.'};
 const alias=u.hostname.endsWith('shopee.com.br')||u.hostname.endsWith('shopee.com')
  ?u.pathname.match(/^\/([a-z0-9][a-z0-9_.-]{1,79})\/?$/i):null;
 if(alias && !['search','shop','product','cart','user','mall','buyer','flash_sale'].includes(alias[1].toLowerCase())){
  return {kind:'profile',profile:alias[1],message:'Este link contém o nome de usuário da loja, não um ID numérico. Você pode colar o link em Configurações: o ID é opcional.'};
 }
 return {kind:'unknown',message:'Link da Shopee reconhecido, mas o ID numérico não está visível. Use o link completo na sua vitrine; não é necessário descobrir o ID.'};
}
function shopIdGuide(){return `<section class="panel guide-panel" aria-labelledby="shopIdTitle">
 <div class="panel-title"><h3 id="shopIdTitle">Onde encontrar o ID da loja Shopee?</h3><span class="pill green">Opcional</span></div>
 <p><strong>Para criar uma vitrine aqui, você não precisa do ID numérico.</strong> Basta entrar com Google e adicionar seu link de afiliado.</p>
 <div class="guide-steps">
  <div><span class="guide-count">1</span><p>Abra a <a class="text-link" href="https://shopee.com.br" target="_blank" rel="noopener noreferrer">Shopee</a> e visite a loja desejada.</p></div>
  <div><span class="guide-count">2</span><p>No aplicativo ou navegador, toque em <strong>Compartilhar → Copiar link</strong> e cole abaixo.</p></div>
  <div><span class="guide-count">3</span><p>Se o endereço mostrar <code>/shop/123456789</code> ou <code>?shopid=123456789</code>, o número é o ID. Se mostrar somente o nome da loja, não é possível garantir o ID por esse link.</p></div>
 </div>
 <form data-form="find-shop-id" class="guide-checker">
  <label class="form-control"><span class="form-label">Cole aqui o link da loja</span><input class="field" name="shopLink" type="url" required placeholder="https://shopee.com.br/q63ifc2_ce" autocomplete="off" aria-label="Link da loja Shopee"></label>
  <button class="btn btn-orange" type="submit">Verificar link</button>
 </form>
 <div class="guide-result" data-shop-id-result role="status" aria-live="polite">Exemplo: no link <code>shopee.com.br/q63ifc2_ce</code>, <strong>q63ifc2_ce</strong> é o nome do perfil, não um ID numérico.</div>
 <details class="simple-details"><summary>Não apareceu o número? Veja alternativas</summary>
  <p>Na <a class="text-link" href="https://seller.shopee.com.br" target="_blank" rel="noopener noreferrer">Central do Vendedor</a>, procure <strong>Perfil da Loja → Visualizar minha loja</strong> e confira o endereço. Em algumas páginas o ID aparece após <code>/shop/</code> ou <code>shopid=</code>; em outras, aparece só o nome de usuário. Se o ID for indispensável para uma integração específica, consulte o suporte oficial da Shopee.</p>
  <p><strong>Não confunda:</strong> ID da loja = número da loja do vendedor; App ID + Secret = credenciais da API de Afiliados; ID do afiliado = identificador da conta de afiliado. Um não substitui o outro.</p>
  <p>Para ganhar comissão, gere o <strong>link de afiliado</strong> na sua conta, no menu <strong>Conta → Link de Conversão</strong> (app) ou <strong>Oferta → Link Personalizado</strong> (portal). <a class="text-link" href="https://help.shopee.com.br/portal/10/article/128461-Como-gerar-links-de-produtos-ou-lojas" target="_blank" rel="noopener noreferrer">Instruções oficiais da Shopee ↗</a>.</p>
 </details>
 </section>`;}
function updateShopIdResult(form){
 const output=form.closest('.guide-panel')?.querySelector('[data-shop-id-result]');
 if(!output)return;
 const found=detectShopFromLink(new FormData(form).get('shopLink'));
 if(found.kind==='id')output.innerHTML=`<strong>${h(found.message)}</strong> <code>${h(found.id)}</code><button type="button" class="btn btn-white btn-sm" data-action="copy-shop-id" data-shop-id="${h(found.id)}">Copiar ID</button>`;
 else if(found.kind==='profile')output.innerHTML=`<strong>Perfil: ${h(found.profile)}</strong> — ${h(found.message)}`;
 else output.textContent=found.message;
}

function home(){const shown=state.shops.filter(s=>(s.name+' '+s.description).toLowerCase().includes(state.homeQuery.toLowerCase()));return `<section class="hero"><div class="container"><div class="hero-panel"><div class="hero-content"><span class="eyebrow">✦ Sua loja, suas indicações</span><h1>Crie sua vitrine de afiliados <span class="brand-accent">em 3 passos.</span></h1><p>Entre com Google, cole seu link de afiliado e compartilhe sua loja pública. Sem ID de loja, sem API obrigatória.</p><div class="hero-actions"><button class="btn btn-orange" data-action="start-store">Criar minha vitrine gratuita →</button><a href="#/como-funciona" class="btn btn-white">Como funciona</a></div></div><div class="hero-art" aria-hidden="true"><div class="dots-bg"></div><div class="hero-orbit"></div><div class="hero-orbit small"></div><div class="hero-illustration"><span>✓</span></div><div class="floating-card">✦ Sua vitrine online</div><div class="floating-card second">Compras na Shopee ↗</div></div></div></div></section><section class="section"><div class="container"><div class="section-heading"><div><span class="eyebrow">Descubra</span><h2>Vitrines para explorar</h2><p>Seleções de afiliados reais que você pode visitar sem precisar de conta.</p></div><span class="pill gray">${state.shops.length} ${state.shops.length===1?'vitrine pública':'vitrines públicas'}</span></div><form class="searchbar" data-form="search-home" style="margin-bottom:22px"><span class="searchbar-icon">⌕</span><input name="search" placeholder="Pesquisar uma vitrine ou uma categoria..." value="${h(state.homeQuery)}" aria-label="Buscar vitrines"><button class="btn btn-orange btn-sm">Buscar</button></form>${state.publicError?alertBox('warning',h(state.publicError)):''}${shown.length?`<div class="shop-grid">${shown.map(s=>`<a class="shop-card" href="#/loja/${encodeURIComponent(s.ownerUid)}"><div class="shop-card-top"><div class="store-logo">${h(initials(s.name))}</div><div><span class="pill orange">Vitrine pública</span><h3 style="margin-top:6px">${h(s.name)}</h3></div></div><p>${h(s.description||'Produtos selecionados por um afiliado.')}</p><div class="shop-card-bottom"><span>${Number(s.productCount)||0} produtos</span><span class="text-link">Visitar vitrine →</span></div></a>`).join('')}</div>`:empty('▦',state.homeQuery?'Nenhuma vitrine encontrada':'As primeiras vitrines aparecerão aqui',state.homeQuery?'Tente pesquisar por outro termo.':'Entre com Google e crie a primeira vitrine pública da plataforma.',`<button class="btn btn-orange" data-action="start-store">Criar minha vitrine →</button>`)}</div></section><section class="section"><div class="container"><div class="section-heading"><div><span class="eyebrow">Simples para quem vende e quem compra</span><h2>Tudo no mesmo lugar</h2></div></div><div class="feature-grid"><article class="feature-card"><div class="feature-icon">⌕</div><h3>Busque produtos</h3><p>Pesquise produtos na Shopee e copie o seu próprio link de afiliado. A API é opcional.</p></article><article class="feature-card"><div class="feature-icon">▤</div><h3>Tenha sua loja pública</h3><p>Compartilhe um endereço exclusivo. Qualquer pessoa pode ver seus produtos e comprar diretamente na Shopee.</p></article><article class="feature-card"><div class="feature-icon">◴</div><h3>Veja suas comissões</h3><p>Veja as comissões quando ativar a API de afiliados; sem ela, consulte o portal oficial.</p></article></div></div></section>`;}
function how(){return `<section class="section"><div class="container" style="padding-top:32px">
 <div class="page-header"><div><span class="eyebrow">Guia simples</span><h1>Comece em três passos</h1><p>Você não precisa localizar o ID da loja ou conectar uma API para publicar links de afiliado já convertidos.</p></div></div>
 <div class="feature-grid">
  <article class="feature-card"><div class="feature-icon">1</div><h3>Entre com Google</h3><p>Sua vitrine pública é criada automaticamente com o nome do seu perfil.</p></article>
  <article class="feature-card"><div class="feature-icon">2</div><h3>Copie seu link de afiliado</h3><p>Abra a Shopee Afiliados, escolha um produto e gere seu link em Link de Conversão. Depois cole o link e o título do produto no painel.</p></article>
  <article class="feature-card"><div class="feature-icon">3</div><h3>Divulgue sua loja</h3><p>Copie o endereço da vitrine e envie aos clientes. Eles compram diretamente na Shopee, com o link que você publicou.</p></article>
 </div>
 <div class="form-actions" style="margin:22px 0"><button class="btn btn-orange" data-action="start-store">Criar minha vitrine →</button><a class="btn btn-white" target="_blank" rel="noopener noreferrer" href="https://help.shopee.com.br/portal/10/article/128461-Como-gerar-links-de-produtos-ou-lojas">Como gerar links oficiais ↗</a></div>
 ${shopIdGuide()}
 </div></section>`;}
function store(){
 const s=state.publicShop;
 if(state.loadingStore)return loading('Preparando sua vitrine...');
 if(!s)return `<div class="container section">${empty('▢','Vitrine não encontrada','Esta loja não existe ou não está pública.',`<a href="#/" class="btn btn-orange">Explorar vitrines</a>`)}</div>`;
 const own=state.user?.uid===s.ownerUid;
 const products=state.publicProducts.filter(p=>((state.category==='Tudo')||(p.category===state.category))&&(p.name+' '+(p.description||'')).toLowerCase().includes(state.storeQuery.toLowerCase()));
 const link=shopUrl(s.ownerUid);
 return `<div class="container storefront-page">
  <section class="storefront-hero" aria-labelledby="store-name">
   <div class="storefront-copy"><span class="storefront-tag">✦ VITRINE PÚBLICA · SELEÇÃO DE AFILIADOS</span>
    <div class="storefront-identity"><div class="storefront-avatar">${h(initials(s.name))}</div><div><span class="storefront-overline">Encontre seus próximos favoritos</span><h1 id="store-name">${h(s.name)}</h1></div></div>
    <p class="storefront-description">${h(s.description||'Uma seleção de produtos especiais para você descobrir.')}</p>
    <div class="storefront-stats"><span>✦ <b>${state.publicProducts.length}</b> ${state.publicProducts.length===1?'achado':'achados'} na vitrine</span><span>✓ Compras diretamente na Shopee</span></div>
    <div class="storefront-hero-actions">${shareButtons(s.ownerUid,s.name)}${own?`<a href="#/adicionar" class="btn btn-hero-outline btn-sm">+ Adicionar produto</a>`:''}</div>
   </div>
   <div class="storefront-illustration" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="gift-card"><span class="gift-star">✦</span><span class="gift-line"></span><span class="gift-line narrow"></span><span class="gift-dot">♥</span></div><div class="floating-emoji coin">★</div><div class="floating-emoji heart">♥</div><div class="floating-label">curadoria especial ✧</div></div>
  </section>
  <div class="storefront-share-strip"><div><span class="storefront-link-label">SEU LINK DESTA VITRINE</span><strong>${h(link)}</strong><small>Envie para amigos, família ou compartilhe nas redes sociais.</small></div>${shareButtons(s.ownerUid,s.name)}</div>
  <section class="storefront-collection"><div class="storefront-section-top"><div><span class="eyebrow">ESCOLHAS FEITAS PARA VOCÊ</span><h2>Garimpos que valem o clique<span class="brand-accent">.</span></h2><p>${products.length} ${products.length===1?'produto disponível':'produtos disponíveis'} nesta seleção</p></div>${own?'<a href="#/adicionar" class="btn btn-orange btn-sm">+ Novo produto</a>':''}</div>
  <form class="searchbar storefront-search" data-form="search-store"><span class="searchbar-icon">⌕</span><input name="search" value="${h(state.storeQuery)}" placeholder="Busque um produto nesta vitrine..." aria-label="Pesquisar produtos da vitrine"><button class="btn btn-orange btn-sm">Buscar</button></form>
  <div class="chips storefront-categories">${categories.map(c=>`<button class="chip ${state.category===c?'active':''}" data-action="category" data-category="${h(c)}">${h(c)}</button>`).join('')}</div>
  ${products.length?`<div class="product-grid storefront-products">${products.map(p=>productCard(p,own)).join('')}</div>`:empty('▧',state.publicProducts.length?'Não encontramos produtos para esse filtro':'Sua vitrine está prontinha para receber produtos',state.publicProducts.length?'Tente pesquisar por outro nome ou categoria.':'Adicione seu primeiro link de afiliado para mostrar seus produtos.',own?'<a href="#/adicionar" class="btn btn-orange">Adicionar meu primeiro produto</a>':'')}
  </section><div class="storefront-disclaimer">✓ Vitrine independente de afiliados. Ao comprar, você será direcionado ao site ou aplicativo oficial da Shopee. Preços e disponibilidade podem mudar.</div>
 </div>`;
}
function sidebar(){const items=[['painel','▦','Início'],['adicionar','＋','Adicionar produto'],['produtos','▤','Meus produtos'],['catalogo','⌕','Pesquisar na Shopee'],['financeiro','◴','Comissões'],['configuracoes','⚙','Minha loja']];const u=state.user;return `<aside class="sidebar"><div class="side-profile"><span class="avatar">${h(initials(u?.displayName))}</span><div style="min-width:0"><strong>${h(u?.displayName||'Minha conta')}</strong><small>Minha vitrine de afiliados</small></div></div><nav class="side-nav">${items.map(([id,icon,label])=>`<a href="#/${id}" class="${state.route===id?'active':''}"><span class="side-icon">${icon}</span>${h(label)}</a>`).join('')}</nav><div class="sidebar-bottom">Vitrine Livre · administração privada</div></aside>`;}
function adminPage(body){return `<div class="container layout">${sidebar()}<div class="dashboard-main">${state.ownerError?alertBox('danger',`<strong>Configuração do Realtime Database pendente.</strong> ${h(state.ownerError)} <a href="https://console.firebase.google.com/project/gahepatama-4707c/database" target="_blank" rel="noopener noreferrer">Abrir Firebase ↗</a>`):''}${body}</div></div>`;}
function adminHead(title,desc,actions=''){return `<div class="page-header"><div><span class="eyebrow">Área do afiliado</span><h1>${h(title)}</h1><p>${h(desc)}</p></div><div class="page-header-actions">${actions}</div></div>`;}
function metric(label,value,icon,detail){return `<div class="metric"><div class="metric-icon">${icon}</div><div class="metric-label">${h(label)}</div><div class="metric-value">${value}</div><div class="metric-detail">${h(detail)}</div></div>`;}
function adminHome(){
 const s=state.shop,r=state.report?.summary;
 return adminPage(adminHead('Minha vitrine','Seu primeiro produto pode ser publicado sem ID de loja e sem API.',`${s?`<a href="#/loja/${encodeURIComponent(s.ownerUid)}" class="btn btn-white btn-sm">↗ Ver minha vitrine</a>`:''}<a href="#/adicionar" class="btn btn-orange btn-sm">+ Adicionar produto</a>`)
 +`<div class="welcome-share"><div><span>✦ SUA VITRINE ESTÁ NO AR</span><strong>${h(s?.name||'Minha vitrine')}</strong><small>Divulgue suas escolhas favoritas em um único link.</small></div>${s?shareButtons(s.ownerUid,s.name):''}</div><div class="panel quick-panel"><div class="panel-title"><h3>Comece por aqui</h3><span class="pill green">3 passos</span></div><div class="quick-steps">
  <div class="quick-step"><span class="guide-count complete">✓</span><div><strong>Entre com Google</strong><p>Sua conta e sua vitrine já estão prontas.</p></div></div>
  <div class="quick-step"><span class="guide-count">2</span><div><strong>Adicione o primeiro link de afiliado</strong><p>Gere o link na Shopee e cole aqui o título e o endereço.</p><a href="#/adicionar" class="text-link">Adicionar produto →</a></div></div>
  <div class="quick-step"><span class="guide-count">3</span><div><strong>Compartilhe sua vitrine</strong><p>Qualquer pessoa pode ver seus produtos e comprar na Shopee.</p></div></div>
 </div>${s?`<div class="sharing"><label>LINK DA SUA VITRINE PÚBLICA</label><div class="share-line"><input readonly aria-label="Link público da minha vitrine" value="${h(shopUrl(s.ownerUid))}"><button class="btn btn-orange btn-sm" data-action="copy" data-url="${h(shopUrl(s.ownerUid))}">Copiar</button></div></div>`:''}</div>
 <div class="metric-grid">${metric('Produtos publicados',state.myProducts.length,'▤','Visíveis na vitrine pública')}${metric('Comissões estimadas',r?money(r.total):'—','R$','Somente após ativar a API de afiliados')}${metric('Vitrine',s?.isPublic===false?'Privada':'Pública','◎','Link compartilhável')}</div>
 <div class="panel"><div class="panel-title"><h3>Precisa do ID da sua loja Shopee?</h3><span class="pill gray">Não obrigatório</span></div><p>Para a vitrine funcionar, basta o link de afiliado. Se outra ferramenta pedir o número da loja, nosso guia explica onde procurar.</p><div class="form-actions"><a href="#/ajuda-id" class="btn btn-white">Onde encontrar o ID →</a><a href="#/configuracoes" class="text-link">Personalizar minha loja →</a></div></div>
 ${state.myProducts.length?`<div class="section-heading" style="margin-top:22px"><div><h2>Últimos produtos</h2></div><a href="#/produtos" class="text-link">Ver todos →</a></div><div class="product-grid">${state.myProducts.slice(0,4).map(p=>productCard(p,true)).join('')}</div>`:''}`);
}
function catalog(){return adminPage(adminHead('Buscar produtos','Pesquise diretamente na Shopee ou pela sua API de afiliados, quando conectada.','<a href="#/adicionar" class="btn btn-white btn-sm">Tenho um link da Shopee →</a>')+(!state.connected?alertBox('warning','<strong>Busca disponível.</strong> Pesquise diretamente na Shopee e adicione o link que você converteu no programa de afiliados. Para resultados integrados e geração automática, conecte a API em <a href="#/configuracoes">Configurações</a>.'):alertBox('info','Os produtos vêm da API de afiliados. Ao adicionar, o sistema gera um link associado às suas credenciais e publica em sua vitrine.'))+`<div class="panel"><div class="panel-title"><h3>Pesquisar catálogo Shopee</h3><span class="pill orange">${state.connected?'API de afiliados':'Busca externa Shopee'}</span></div><form class="search-tool" data-form="search-offers"><div class="searchbar"><span class="searchbar-icon">⌕</span><input name="keyword" value="${h(state.offerQuery)}" placeholder="Ex.: fone bluetooth, air fryer, camiseta..." aria-label="Busca de ofertas Shopee" required minlength="2"><button class="btn btn-orange btn-sm">${state.connected?'Buscar ofertas':'Buscar na Shopee ↗'}</button></div></form>${state.loadingOffers?loading('Buscando ofertas da Shopee...'):(state.offers.length?`<div style="margin-bottom:14px" class="result-count">${state.offers.length} ofertas encontradas ${state.offerPage>1?'· página '+state.offerPage:''}</div><div class="product-grid">${state.offers.map(offerCard).join('')}</div>${state.offerNext?`<div style="text-align:center;margin-top:18px"><button data-action="more-offers" class="btn btn-white">Carregar mais ofertas</button></div>`:''}`:empty('⌕','Encontre produtos para sua vitrine',state.connected?'Digite o nome de um produto e clique em Buscar ofertas.':'Pesquise na Shopee sem integração e publique links já convertidos no programa de afiliados.',`<a href="#/adicionar" class="btn btn-white">Adicionar pelo link →</a>`))}</div>`);}
function addManual(){return adminPage(adminHead('Adicionar produto','Cole seu link da Shopee e deixe que a plataforma tente encontrar a foto automaticamente.')
 +`<div class="panel add-easy-panel"><div class="panel-title"><h3>Seu produto, em poucos cliques</h3><span class="pill green">✨ Simples e rápido</span></div>
 <form data-form="manual-product" class="easy-product-form">
  <div class="capture-url"><label class="form-control"><span class="form-label"><span class="mini-step">1</span> Cole seu link de afiliado da Shopee *</span><input name="affiliateUrl" class="field capture-input" type="url" required placeholder="https://s.shopee.com.br/..." autocomplete="off" inputmode="url" aria-describedby="preview-status"><span class="hint">Use o link que você gerou no programa de afiliados. O site não transforma um link comum em link com comissão.</span></label>
  <button type="button" class="btn btn-white btn-sm" data-action="retry-preview">⌕ Buscar imagem</button></div>
  <p id="preview-status" class="preview-status" data-preview-status data-status="idle" role="status" aria-live="polite">Cole um link para tentar encontrar a imagem e o título automaticamente.</p>
  <small class="hint">Prévia automática opcional: a URL pode ser consultada num serviço externo. Se a Shopee bloquear, ajuste a foto manualmente.</small>
  <div class="easy-preview-layout"><div class="mini-preview" data-preview-card><div class="mini-preview-image"><span aria-hidden="true">▣</span></div><div class="mini-preview-text"><span>PRÉVIA DA VITRINE</span><strong>Seu produto aparecerá aqui</strong><small>Foto e título serão preenchidos quando disponíveis.</small></div></div>
   <label class="form-control easy-title"><span class="form-label"><span class="mini-step">2</span> Título do produto *</span><input name="name" class="field" required maxlength="180" placeholder="Preenchido automaticamente quando disponível"><span class="hint">Você sempre pode ajustar o nome.</span></label>
  </div>
  <details class="simple-details easy-extra"><summary>✎ Ajustar foto, preço ou categoria (opcional)</summary><div class="form-grid" style="margin-top:16px">
   <label class="form-control span-2"><span class="form-label">Foto do produto — URL HTTPS</span><input name="image" type="url" class="field" placeholder="https://exemplo.com/foto.jpg"><span class="hint">Se a busca automática não encontrar uma foto, cole aqui o link da imagem.</span></label>
   <label class="form-control"><span class="form-label">Preço informativo</span><input name="price" type="number" min="0" step="0.01" class="field" placeholder="49.90"></label>
   <label class="form-control"><span class="form-label">Categoria</span><select name="category" class="field">${categories.slice(1).map(x=>`<option value="${h(x)}">${h(x)}</option>`).join('')}</select></label>
   <label class="form-control span-2"><span class="form-label">Link original do produto (se diferente do link de afiliado)</span><input name="originalUrl" type="url" class="field" placeholder="https://shopee.com.br/..."></label>
   <label class="form-control span-2"><span class="form-label">Descrição curta</span><textarea name="description" maxlength="350" class="field field-area" placeholder="Uma frase sobre o produto"></textarea></label>
  </div></details>
  <div class="easy-submit"><div><span>✓ Sua vitrine pública já está pronta</span><small>Você controla os produtos e os visitantes compram diretamente na Shopee.</small></div><button type="submit" class="btn btn-orange btn-primary-action">Publicar produto →</button></div>
 </form></div>
 <div class="panel"><strong>Não tem um link de afiliado?</strong><p style="margin-top:7px">Abra o programa de afiliados da Shopee, escolha o produto e use a opção de converter ou obter link. Depois volte e cole aqui.</p><div class="form-actions"><a href="https://help.shopee.com.br/portal/10/article/128461-Como-gerar-seus-links-de-Afiliado-ou-ID-de-produto-para-compartilhar" target="_blank" rel="noopener noreferrer" class="btn btn-white">Como obter o link ↗</a><a href="#/catalogo" class="text-link">Pesquisar na Shopee →</a></div></div>
 ${state.connected?`<details class="panel advanced-section"><summary>Avançado: gerar link rastreável pela API Shopee</summary><p>Exige credenciais da Open API já conectadas e Cloud Functions implantadas.</p><form data-form="api-product"><div class="form-grid"><label class="form-control span-2"><span class="form-label">Nome *</span><input name="name" class="field" maxlength="180" required></label><label class="form-control span-2"><span class="form-label">URL original *</span><input name="originalUrl" class="field" type="url" required></label></div><div class="form-actions"><button type="submit" class="btn btn-orange">Gerar link e publicar</button></div></form></details>`:''}
 `);}
function adminProducts(){return adminPage(adminHead('Meus produtos','Gerencie os itens publicados na sua vitrine.',`<a href="#/adicionar" class="btn btn-orange btn-sm">+ Novo produto</a>`)+(state.myProducts.length?`<div class="panel"><div class="panel-title"><h3>Produtos publicados</h3><span class="pill gray">${state.myProducts.length} itens</span></div><div class="table-scroll"><table class="table"><thead><tr><th>Produto</th><th>Preço</th><th>Link</th><th>Origem</th><th>Ações</th></tr></thead><tbody>${state.myProducts.map(p=>`<tr><td><div class="table-product">${safeImage(p.image)?`<img class="table-product-thumb" src="${h(safeImage(p.image))}" alt="">`:'<div class="table-product-thumb" style="display:grid;place-items:center">▧</div>'}<div><strong>${h(p.name)}</strong><small>${h(p.category)}</small></div></div></td><td>${p.price==null?'—':money(p.price)}</td><td><span class="pill ${p.trackingSource==='api'?'green':'gray'}">${p.trackingSource==='api'?'Link da API':'Link informado'}</span></td><td>Shopee</td><td><div class="table-actions"><a class="btn btn-white btn-sm" href="${h(validShopee(p.affiliateUrl)?p.affiliateUrl:'https://shopee.com.br')}" rel="noopener noreferrer sponsored" target="_blank">Abrir ↗</a><button class="btn btn-outline btn-sm" data-action="remove-product" data-id="${h(p.id)}">Excluir</button></div></td></tr>`).join('')}</tbody></table></div></div>`:empty('▤','Sua vitrine está esperando produtos','Busque produtos da Shopee ou adicione seu próprio link de afiliado.',`<a href="#/catalogo" class="btn btn-orange">Buscar produtos →</a>`)));}
function finance(){const r=state.report?.summary;const days=state.report?.days||30;return adminPage(adminHead('Minhas comissões','Acompanhe os resultados disponíveis na sua API de Afiliados Shopee.',`<button class="btn btn-orange btn-sm" data-action="load-report" data-days="30">↻ Consultar Shopee</button>`)+alertBox('info','Os números abaixo são <strong>conversões e comissões reportadas pela API</strong>. Não representam dinheiro disponível para saque; valores estimados podem mudar até a validação e não incluem necessariamente todos os períodos.')+(!state.connected?alertBox('warning','Conecte sua API de afiliados em <a href="#/configuracoes">Configurações</a> para consultar valores reais.'):state.reportError?alertBox('danger',h(state.reportError)):'')+`<div class="report-band"><span class="eyebrow white">COMISSÃO ESTIMADA · ÚLTIMOS ${days} DIAS</span><strong>${r?money(r.total):'—'}</strong><p>${r?'Valor informado pelo relatório de conversões da Shopee.':'Clique em Consultar Shopee para carregar os valores da sua conta.'}</p>${r?`<div class="report-bars"><span style="width:${Math.min(100,r.total>0?r.completed/r.total*100:0)}%"></span><span style="width:${Math.min(100,r.total>0?r.pending/r.total*100:0)}%"></span></div><small>Concluídos e pendentes classificados por status de pedidos; alguns pedidos podem misturar status.</small>`:''}</div><div class="metric-grid">${metric('Estimadas na vitrine',r?money(r.siteTotal):'—','◎','Com identificação SubId shopeepanel')}${metric('Pedidos informados',r?String(r.orders):'—','▤','Janela do relatório')}${metric('Comissões concluídas',r?money(r.completed):'—','✓','Ainda sujeitas à validação')}${metric('Conversões únicas',r?String(r.conversions):'—','◴','Registros encontrados na API')}</div><div class="panel"><div class="panel-title"><h3>Sobre os números</h3><span class="pill orange">Transparência</span></div><p>O total da conta inclui as conversões reportadas pela Shopee nos últimos ${days} dias. A comissão atribuída a esta vitrine considera a marcação SubId dos links gerados aqui. Links adicionados manualmente podem não ser identificados como vendas desta vitrine.</p><div class="form-actions"><button class="btn btn-white" data-action="load-report" data-days="7">Últimos 7 dias</button><button class="btn btn-white" data-action="load-report" data-days="30">Últimos 30 dias</button></div>${r?`<div class="status-row">${r.partial?'⚠ O relatório pode estar incompleto por limite de paginação.':'✓ Relatório consultado em '+formattedDate(state.report.consultedAt)}</div>`:''}</div>`);}
function settings(){const s=state.shop||{};return adminPage(adminHead('Minha loja','Personalize sua vitrine. O ID numérico da Shopee não é obrigatório.')
 +`<div class="panel"><div class="panel-title"><h3>Dados públicos da vitrine</h3><span class="pill green">Fácil de editar</span></div>
 <form data-form="store-settings"><div class="form-grid">
 <label class="form-control span-2"><span class="form-label">Nome da minha vitrine *</span><input class="field" name="name" required maxlength="70" value="${h(s.name||'Minha vitrine')}"></label>
 <label class="form-control span-2"><span class="form-label">Descrição</span><textarea name="description" class="field field-area" maxlength="240">${h(s.description||'')}</textarea></label>
 <label class="form-control span-2"><span class="form-label">Link da loja Shopee (opcional)</span><input class="field" name="referenceUrl" type="url" value="${h(s.referenceUrl||'')}" placeholder="https://shopee.com.br/q63ifc2_ce"><span class="hint">Na Shopee, abra o perfil da loja → Compartilhar → Copiar link. Basta o endereço; o número da loja não é necessário.</span></label>
 </div><label class="public-toggle"><input type="checkbox" name="isPublic" ${s.isPublic!==false?'checked':''}> Permitir que qualquer visitante veja minha vitrine</label><div class="form-actions"><button class="btn btn-orange" type="submit">Salvar alterações</button></div></form>
 ${s.ownerUid?`<div class="sharing"><label>MEU LINK PÚBLICO</label><div class="share-line"><input readonly value="${h(shopUrl(s.ownerUid))}" aria-label="Link público"><button class="btn btn-orange btn-sm" data-action="copy" data-url="${h(shopUrl(s.ownerUid))}">Copiar</button></div>${shareButtons(s.ownerUid,s.name)}</div>`:''}</div>
 <details class="simple-details guide-disclosure"><summary>Como encontrar o ID da loja Shopee? (opcional)</summary>${shopIdGuide()}</details>
 <details class="panel advanced-section"><summary>Integração avançada: API Shopee e comissões <span class="pill ${state.connected?'green':'gray'}">${state.connected?'Conectada':'Opcional'}</span></summary>
  <p>Você <strong>não precisa</strong> desta integração para criar a vitrine, adicionar seus links e compartilhá-la. Ela serve para procurar ofertas pela API, gerar links automaticamente e consultar comissões. Requer backend Firebase configurado.</p>
  ${state.connected?`<div class="connected"><strong>✓ API de afiliados vinculada</strong></div><div class="form-actions"><button class="btn btn-outline" data-action="disconnect">Desconectar API</button></div>`:`<form data-form="affiliate-connect"><div class="form-grid">
   <label class="form-control span-2"><span class="form-label">App ID da Open API de Afiliados</span><input name="appId" class="field" required minlength="3" maxlength="100" autocomplete="off" placeholder="Obtido no portal de afiliados"></label>
   <label class="form-control span-2"><span class="form-label">Secret da Open API (não é sua senha da Shopee)</span><input name="secret" type="password" class="field" required minlength="6" maxlength="300" autocomplete="new-password" placeholder="Chave secreta da API"></label>
  </div><div class="form-actions"><button type="submit" class="btn btn-orange">Conectar API</button><a class="text-link" href="https://affiliate.shopee.com.br/open_api" target="_blank" rel="noopener noreferrer">Onde conseguir App ID e Secret ↗</a></div></form>`}
  <p class="hint">O ID numérico da loja é diferente do App ID, da senha da API e do ID de afiliado. O Gmail não vincula automaticamente a sua conta Shopee.</p>
 </details>
 <div class="panel"><h3>Conta</h3><p>O login Google protege a edição da sua vitrine. Seus visitantes não precisam entrar para comprar.</p><div class="form-actions"><button class="btn btn-white" data-action="logout">Sair da conta Google</button></div></div>`);}
function authNeeded(){return `<div class="container"><div class="auth-card"><div class="empty-icon">◈</div><span class="eyebrow">Acesso do afiliado</span><h2>Entre para criar sua vitrine</h2><p>Use sua conta Google para gerenciar produtos, criar links de afiliado e consultar suas comissões de forma privada.</p><button class="btn btn-google" data-action="login"><span class="google-g">G</span> Continuar com Google</button><div class="alert info" style="margin-top:20px;text-align:left;font-size:12px">Entrar com Google não conecta automaticamente sua conta Shopee. Você poderá vincular a API de afiliados depois.</div></div></div>`;}
function render(){renderTop();const restricted=['painel','catalogo','adicionar','produtos','financeiro','configuracoes'];if(!state.authReady){app.innerHTML=loading('Preparando sua vitrine...');return;}if(restricted.includes(state.route)&&!state.user){app.innerHTML=authNeeded();return;}if(state.route==='loja'){app.innerHTML=store();return;}if(state.route==='como-funciona'){app.innerHTML=how();return;}if(state.route==='ajuda-id'){app.innerHTML=`<div class="container section help-page"><div class="page-header"><div><span class="eyebrow">Ajuda Shopee</span><h1>Encontre o link ou ID da loja</h1><p>Sem complicação e sem precisar fazer login.</p></div></div>${shopIdGuide()}<div class="form-actions"><a class="btn btn-orange" href="#/como-funciona">Como criar minha vitrine →</a></div></div>`;return;}if(restricted.includes(state.route)&&state.loading){app.innerHTML=loading('Carregando painel...');return;}switch(state.route){case 'painel':app.innerHTML=adminHome();break;case 'catalogo':app.innerHTML=catalog();break;case 'adicionar':app.innerHTML=addManual();break;case 'produtos':app.innerHTML=adminProducts();break;case 'financeiro':app.innerHTML=finance();break;case 'configuracoes':app.innerHTML=settings();break;default:app.innerHTML=home();}}
async function fetchPublicShops(){
 try{
  const snap=await get(query(dbRef('publicShops'),limitToLast(100)));
  state.shops=Object.entries(snap.val()||{}).map(([uid,s])=>({...s,ownerUid:uid})).filter(s=>s.isPublic===true);
  state.shops.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
  state.publicError='';
 }catch(error){
  state.shops=[];state.publicError=errText(error);
  console.warn('Realtime Database publicShops:',errText(error));
 }
 if(state.route==='home')render();
}
async function fetchStore(uid){
 const nonce=++loadingNonce;
 state.loadingStore=true;state.publicShop=null;state.publicProducts=[];render();
 try{
  uid=uidPath(uid);
  let snap=await get(dbRef('publicShops/'+uid));
  if(!snap.exists() && state.user?.uid===uid)snap=await get(dbRef('shops/'+uid));
  const data=snap.val();
  if(!data||(data.isPublic!==true && state.user?.uid!==uid))throw new Error('Vitrine não disponível.');
  const products=await get(dbRef('publicProducts/'+uid));
  if(nonce!==loadingNonce)return;
  state.publicShop={...data,ownerUid:uid};
  document.title=state.publicShop.name+' | Vitrine Livre';
  state.publicProducts=Object.entries(products.val()||{}).map(([id,p])=>({...p,id}));
  state.publicProducts.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
 }catch(error){
  if(nonce===loadingNonce)console.warn('Realtime Database loja:',errText(error));
 }finally{if(nonce===loadingNonce){state.loadingStore=false;render();}}
}
async function refreshOwn(){
 if(!state.user)return;
 const uid=uidPath(state.user.uid);
 state.ownerError='';
 try{
  let snap=await get(dbRef('shops/'+uid));
  if(!snap.exists()){
   const displayName=displayNameOf(state.user);
   const name='Vitrine de '+displayName.split(' ')[0];
   const timestamp=Date.now();
   const newShop={ownerUid:uid,name,slug:'loja-'+uid.slice(0,8),description:'Seleção de produtos e links de afiliados da Shopee.',referenceUrl:'',productCount:0,isPublic:true,createdAt:timestamp,updatedAt:timestamp};
   await saveStoreData(newShop);
   snap=await get(dbRef('shops/'+uid));
  }
  state.shop={...snap.val(),ownerUid:uid};
  const [prods,status,report]=await Promise.all([
   get(dbRef('publicProducts/'+uid)),
   get(dbRef('affiliateStatus/'+uid)),
   get(dbRef('affiliateReports/'+uid))
  ]);
  state.myProducts=Object.entries(prods.val()||{}).map(([id,p])=>({...p,id})).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  state.connected=status.val()?.connected===true;
  state.report=report.val()||null;
  await updateCounts(uid,state.myProducts.length);
 }catch(error){
  state.ownerError=errText(error);
  state.shop=null;state.connected=false;state.myProducts=[];
  console.warn('Realtime Database do usuário:',state.ownerError);
 }
 render();
}

async function onRoute(){const {route,id}=parseRoute();if(route!=='loja')document.title='Vitrine Livre | Sua loja de afiliados';state.route=route;state.routeId=id;state.storeQuery='';state.category='Tudo';if(!state.authReady){render();return;}if(route==='loja'){await fetchStore(id);return;}render();if(route==='home'&&!state.shops.length)await fetchPublicShops();}
async function logIn(){try{const p=new GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});await signInWithPopup(auth,p);location.hash='#/painel';}catch(error){const code=error?.code||'';let msg=errText(error);if(code.includes('unauthorized-domain'))msg='Autorize perabru.github.io no Firebase Authentication → Settings → Authorized domains.';else if(code.includes('operation-not-allowed'))msg='Ative o provedor Google em Firebase Authentication → Sign-in method.';else if(code.includes('popup-closed-by-user'))return;toast(msg,true);}}
async function loadOffers(keyword,page=1){
 if(!state.connected){
  const search='https://shopee.com.br/search?keyword='+encodeURIComponent(keyword);
  window.open(search,'_blank','noopener,noreferrer');
  toast('Pesquisa aberta na Shopee. Converta o link no programa de afiliados antes de publicar.');
  return;
 }
 state.offerQuery=keyword;state.offerPage=page;state.loadingOffers=true;render();
 try{
  const r=await call('searchOffers',{keyword,page});
  state.offers=page>1?[...state.offers,...(Array.isArray(r.offers)?r.offers:[])]:Array.isArray(r.offers)?r.offers:[];
  state.offerNext=!!r.hasNextPage;
 }catch(error){toast(errText(error),true);state.offers=[];state.offerNext=false;}
 finally{state.loadingOffers=false;render();}
}
async function loadReport(days=30){
 if(!state.connected){toast('Para consultar comissões, conecte a API Shopee em Configurações.',true);return;}
 state.reportError='';toast('Consultando o relatório Shopee...');
 try{const r=await call('getReport',{days});state.report=r;toast('Relatório atualizado.');}
 catch(error){state.reportError=errText(error);toast(state.reportError,true);}
 render();
}
async function publishOffer(index){
 const o=state.offers[index];if(!o)return;
 try{
  toast('Gerando seu link de afiliado...');
  const r=await call('publishProduct',{name:o.name,originalUrl:o.originalUrl,image:o.image,price:o.price,category:'Outros',description:o.shopName?`Vendido na Shopee por ${o.shopName}`:''});
  toast(r.trackingSource==='api'?'Produto publicado com o link de afiliado!':'Produto publicado.');
  await refreshOwn();
 }catch(error){toast(errText(error),true);}
}

function formData(form){return Object.fromEntries(new FormData(form).entries());}
function formBusy(form,isBusy){form.querySelectorAll('button[type="submit"]').forEach(btn=>{btn.disabled=isBusy;btn.dataset.oldLabel??=btn.textContent;btn.textContent=isBusy?'Processando...':btn.dataset.oldLabel;});}
app.addEventListener('submit',async(event)=>{
 const form=event.target.closest('form[data-form]');if(!form)return;
 event.preventDefault();const type=form.dataset.form;const values=formData(form);
 if(type==='search-home'){state.homeQuery=String(values.search||'').trim();render();return;}
 if(type==='search-store'){state.storeQuery=String(values.search||'').trim();render();return;}
  if(type==='find-shop-id'){updateShopIdResult(form);return;}
 if(type==='search-offers'){
  const keyword=String(values.keyword||'').trim();if(keyword.length<2){toast('Digite pelo menos duas letras para pesquisar.',true);return;}
  await loadOffers(keyword,1);return;
 }
 formBusy(form,true);
 try{
  if(type==='manual-product'){
   await saveManualProduct(values);
   toast('Produto publicado! Agora compartilhe sua vitrine.');
   await refreshOwn();await fetchPublicShops();location.hash='#/loja/'+encodeURIComponent(state.user.uid);
  }else if(type==='api-product'){
   if(!state.connected)throw new Error('A API de afiliados ainda não está conectada.');
   await call('publishProduct',{name:values.name,originalUrl:values.originalUrl,description:'',category:'Outros'});
   toast('Link gerado pela API e produto publicado.');
   await refreshOwn();await fetchPublicShops();location.hash='#/produtos';
  }else if(type==='store-settings'){
   if(!state.shop)throw new Error('Não foi possível carregar sua vitrine.');
   const name=safeText(values.name,70),description=safeText(values.description,240),referenceUrl=String(values.referenceUrl||'').trim();
   if(!name)throw new Error('Informe o nome da vitrine.');
   if(referenceUrl&&!validShopee(referenceUrl))throw new Error('A loja de referência precisa ser um link HTTPS da Shopee.');
   const changed={...state.shop,name,description,referenceUrl,isPublic:form.querySelector('[name="isPublic"]').checked,updatedAt:Date.now()};
   await saveStoreData(changed);
   await fetchPublicShops();toast('Sua vitrine foi atualizada.');render();
  }else if(type==='affiliate-connect'){
   await call('connectAffiliate',values);
   await refreshOwn();toast('Conexão com a API Shopee estabelecida.');
  }
 }catch(error){toast(errText(error),true);}finally{if(form.isConnected)formBusy(form,false);}
});

app.addEventListener('input',event=>{
 const form=event.target.closest('form[data-form="manual-product"]');
 if(!form)return;
 if(event.target.name==='affiliateUrl')scheduleProductPreview(form);
 if(['name','image','category'].includes(event.target.name)){
  if(event.target.dataset)event.target.dataset.autofilled='0';
  renderPreviewCard(form);
 }
});

document.addEventListener('click',async(event)=>{
 const el=event.target.closest('[data-action]');if(!el)return;
 const action=el.dataset.action;
 if(action==='login'||action==='start-store'){if(!state.user){await logIn();}else location.hash='#/painel';return;}
 if(action==='logout'){await signOut(auth);location.hash='#/';toast('Você saiu da sua conta.');return;}
 if(action==='retry-preview'){
  const form=el.closest('form[data-form="manual-product"]');
  if(form)scheduleProductPreview(form,true);
  return;
 }
 if(action==='share-shop'){
  const url=el.dataset.url||'',name=el.dataset.name||'Vitrine de afiliados';
  if(!url)return;
  if(navigator.share){
   try{await navigator.share({title:name,text:'Conheça os produtos desta vitrine',url});}
   catch(error){if(error?.name!=='AbortError')toast('Não foi possível compartilhar. Use Copiar link.',true);}
  }else{
   try{await navigator.clipboard.writeText(url);toast('Link copiado! Compartilhe onde preferir.');}
   catch{window.open('https://wa.me/?text='+encodeURIComponent(shareText(name,url)),'_blank','noopener,noreferrer');}
  }
  return;
 }
 if(action==='copy-shop-id'){try{await navigator.clipboard.writeText(el.dataset.shopId||'');toast('ID copiado!');}catch{toast('Não foi possível copiar. Selecione e copie o número.',true);}return;}
  if(action==='copy'){try{await navigator.clipboard.writeText(el.dataset.url||'');toast('Link da vitrine copiado!');}catch{toast('Não foi possível copiar o link automaticamente.',true);}return;}
 if(action==='category'){state.category=el.dataset.category;render();return;}
 if(action==='publish-offer'){el.disabled=true;await publishOffer(Number(el.dataset.index));if(el.isConnected)el.disabled=false;return;}
 if(action==='more-offers'){await loadOffers(state.offerQuery,state.offerPage+1);return;}
 if(action==='load-report'){el.disabled=true;await loadReport(Number(el.dataset.days)||30);if(el.isConnected)el.disabled=false;return;}
 if(action==='remove-product'){
   const product=state.myProducts.find(p=>p.id===el.dataset.id);if(!product||!confirm(`Remover "${product.name}" da vitrine pública?`))return;
   try{await remove(dbRef('publicProducts/'+uidPath(state.user.uid)+'/'+product.id));await refreshOwn();await fetchPublicShops();if(state.route==='loja')await fetchStore(state.routeId);toast('Produto excluído da vitrine.');}catch(error){toast(errText(error),true);}return;
 }
 if(action==='disconnect'){
   if(!confirm('Desconectar sua API de afiliados? Os links publicados anteriormente continuarão disponíveis.'))return;
   try{await call('disconnectAffiliate');await refreshOwn();state.report=null;toast('API desconectada. Seus links públicos foram preservados.');}catch(error){toast(errText(error),true);}return;
 }
});
window.addEventListener('hashchange',onRoute);
onAuthStateChanged(auth,async user=>{
 const prevUid=state.user?.uid||null;state.user=user;state.authReady=true;
 if(!user){state.shop=null;state.connected=false;state.myProducts=[];state.report=null;state.ownerError='';}
 else if(prevUid!==user.uid){state.loading=true;render();await refreshOwn();state.loading=false;}
 await onRoute();
});