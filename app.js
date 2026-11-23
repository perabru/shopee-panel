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
const productTools=globalThis.ProductTools;
let receivedLink='';
try{
 const incoming=new URL(location.href);
 receivedLink=productTools.extractShopeeLink([incoming.searchParams.get('share_url'),incoming.searchParams.get('share_text'),incoming.searchParams.get('share_title')].filter(Boolean).join(' '));
 if(receivedLink){sessionStorage.setItem('vitrine-received-link',receivedLink);for(const key of ['share_url','share_text','share_title'])incoming.searchParams.delete(key);incoming.hash='/adicionar';history.replaceState(null,'',incoming.href);}
 receivedLink=sessionStorage.getItem('vitrine-received-link')||receivedLink;
}catch{}

const categories=['Tudo','Casa','Eletrônicos','Moda','Beleza','Esportes','Games','Acessórios','Lojas','Outros'];
const state={user:null,authReady:false,shop:null,connected:false,shops:[],myProducts:[],publicShop:null,publicProducts:[],offers:[],offerQuery:'',offerPage:1,offerNext:false,report:null,reportError:'',route:'home',routeId:'',loading:false,loadingOffers:false,loadingStore:false,publicError:'',ownerError:'',homeQuery:'',storeQuery:'',category:'Tudo',productQuery:'',editId:'',lastSavedId:''};
let loadingNonce=0;
let toastTimer;

function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
const h=escapeHtml;
function money(value){return value==null?'—':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value)||0);}
function formattedDate(value){return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(value);}
function short(value){return String(value||'').length>80?String(value).slice(0,77)+'…':String(value||'');}
function validShopee(url){return productTools.validShopee(url);}
function safeImage(url){return productTools.safeImage(url);}
function extractShopeeLink(text){return productTools.extractShopeeLink(text);}

function toast(message,isError=false){const el=$('toast');el.textContent=String(message);el.className='toast show'+(isError?' error':'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.className='toast';},5200);}
function errText(error){
 const code=String(error?.code||'').toLowerCase();
 if(code.includes('permission-denied')||code.includes('permission_denied'))return 'Sem permissão no Realtime Database. Publique as regras database.rules.json do projeto no console do Firebase.';
 if(code.includes('unauthorized-domain'))return 'Autorize perabru.github.io em Firebase Authentication Configurações Domínios autorizados.';
 if(code.includes('operation-not-allowed'))return 'Habilite o provedor Google no Firebase Authentication.';
 if(navigator.onLine===false||code.includes('network')||code.includes('disconnected'))return 'Sem conexão com o Firebase. Verifique sua internet e tente novamente.';
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
 const affiliateUrl=extractShopeeLink(input.affiliateUrl);
 // Se não houver link original, use o link afiliado como referência.
 const originalUrl=input.originalUrl?extractShopeeLink(input.originalUrl):affiliateUrl;
 if(!validShopee(originalUrl))throw new Error('Informe um link HTTPS válido da Shopee.');
 if(!validShopee(affiliateUrl))throw new Error('Informe seu link de afiliado já gerado na Shopee. Não é possível gerar atribuição por um link comum.');
 const image=String(input.image||'').trim();
 if(image&&!safeImage(image))throw new Error('A URL da imagem deve usar HTTPS.');
 const price=productTools.parsePrice(input.price);
 if(price!==null&&(!Number.isFinite(price)||price<0||price>1e8))throw new Error('Preço inválido.');
 const category=categories.includes(input.category)?input.category:'Outros';
 const doc={name,description,originalUrl,affiliateUrl,image,category,trackingSource:'manual',published:true,createdAt:Date.now()};
 if(price!==null)doc.price=Math.round(price*100)/100;
 const existing=input.editId?state.myProducts.find(p=>p.id===input.editId):null;
 if(input.editId&&!existing)throw new Error('Produto não encontrado. Volte à lista e tente novamente.');
 if(existing?.trackingSource==='api')throw new Error('A edição de produtos gerados pela API ainda não está disponível. Os links existentes continuam funcionando.');
 if(existing){
  doc.createdAt=existing.createdAt;
  const patch={name,description,originalUrl,affiliateUrl,image,category,price:price===null?null:Math.round(price*100)/100};
  await update(dbRef('publicProducts/'+uid+'/'+existing.id),patch);
  return existing.id;
 }
 if(state.myProducts.some(p=>p.affiliateUrl===affiliateUrl))throw new Error('Este link já está na sua vitrine. Use Editar no produto existente.');
 const node=push(dbRef('publicProducts/'+uid));
 await set(node,doc);
 return node.key;
}

// Descoberta de prévia: a Shopee pode bloquear prévias externas. Nunca inventamos imagens.
let publicPreviewLookup;
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
async function lookupProductPreview(link,force=false){
 if(!validShopee(link))throw new Error('Cole um endereço HTTPS válido da Shopee.');
 publicPreviewLookup??=productTools.createPreviewLookup({fetch:(...args)=>fetch(...args)});
 let page=null,pageError=null;
 try{page=await publicPreviewLookup(link,{force});}catch(error){pageError=error;}
 // A leitura da página também traz a descrição; a API complementa somente os campos ausentes.
 const needsApi=!page||!page.name||!page.image||(page.price==null&&!page.priceNote);
 if(state.connected&&needsApi){
  const sourceUrl=[page?.canonicalUrl,page?.resolvedUrl,pageError?.canonicalUrl,link].find(validShopee)||link;
  try{
   const result=await httpsCallable(functions,'previewProduct',{timeout:10000})({url:sourceUrl});
   const offer=result?.data?.offer;
   if(offer){
    const merged={...(page||{}),images:[...(page?.images||[])],source:page?'página do produto e API Shopee':'API oficial Shopee'};
    merged.name ||= previewTitle(offer.name);
    const apiImage=safeImage(offer.image);
    if(!merged.image&&apiImage){merged.image=apiImage;if(!merged.images.includes(apiImage))merged.images.unshift(apiImage);}
    if(!merged.description&&offer.description)merged.description=safeText(offer.description,350);
    if(merged.price==null&&!merged.priceNote&&offer.price!=null&&String(offer.price).trim()!==''&&Number.isFinite(Number(offer.price))&&Number(offer.price)>=0){
     merged.price=Number(offer.price);merged.priceSource='API oficial Shopee';
     merged.priceNote='Preço informado pela API. Confirme a variação escolhida na Shopee.';
    }
    if(merged.name||merged.image||merged.description||merged.price!=null)return merged;
   }
  }catch(error){console.info('Dados pela API indisponíveis:',errText(error));}
 }
 if(page)return page;
 throw pageError||new Error('A página não disponibilizou os dados do produto.');
}

function productFieldStatus(form){
 const field=name=>form.querySelector('[name="'+name+'"]');
 let hasPrice=false;
 try{hasPrice=productTools.parsePrice(field('price')?.value)!=null;}catch{}
 return [
  {name:'Nome',ready:!!String(field('name')?.value||'').trim()},
  {name:'Foto',ready:!!safeImage(field('image')?.value)&&form.dataset.photoFailed!==field('image')?.value},
  {name:'Preço',ready:hasPrice},
  {name:'Descrição',ready:!!String(field('description')?.value||'').trim()}
 ];
}
function renderProductFieldStatus(form){
 const fields=form.querySelector('[data-import-fields]');
 if(!fields)return;
 fields.innerHTML=productFieldStatus(form).map(item=>`<span class="import-field" data-ready="${item.ready}"><span aria-hidden="true">${item.ready?'✓':'○'}</span> ${item.name}<span class="sr-only">: ${item.ready?'preenchido':'pendente'}</span></span>`).join('');
}
function showProductPriceNote(form,note){
 const el=form.querySelector('[data-price-note]');
 if(!el)return;
 el.textContent=String(note||'');el.hidden=!note;
}

function fillProductPreview(form,info){
 const title=form.querySelector('[name="name"]');
 const image=form.querySelector('[name="image"]');
 const price=form.querySelector('[name="price"]');
 const description=form.querySelector('[name="description"]');
 const suggested=info.name||guessNameFromLink(extractShopeeLink(form.elements.affiliateUrl.value));
 if(title&&suggested&&title.dataset.autofilled!=='0'&&(!title.value||title.dataset.autofilled==='1')){
  title.value=suggested;title.dataset.autofilled='1';
 }
 if(image&&info.image&&image.dataset.autofilled!=='0'&&(!image.value||image.dataset.autofilled==='1')){
  image.value=info.image;image.dataset.autofilled='1';
 }
 if(price&&price.dataset.autofilled!=='0'&&info.price!=null&&String(info.price).trim()!==''&&(!price.value||price.dataset.autofilled==='1')&&Number.isFinite(Number(info.price))&&Number(info.price)>=0){price.value=Number(info.price).toFixed(2).replace('.',',');price.dataset.autofilled='1';}
 if(description&&info.description&&description.dataset.autofilled!=='0'&&(!description.value||description.dataset.autofilled==='1')){description.value=safeText(info.description,350);description.dataset.autofilled='1';}
 if(Object.prototype.hasOwnProperty.call(info,'priceNote'))showProductPriceNote(form,info.priceNote);
 else if(info.price!=null)showProductPriceNote(form,'Preço encontrado. Confira a disponibilidade e a variação na Shopee.');
 if(info.images?.length){
  const picker=form.querySelector('[data-photo-picker]');
  if(picker){picker.innerHTML=info.images.map((url,i)=>`<button type="button" data-action="pick-photo" data-url="${h(url)}" aria-label="Usar foto ${i+1}" aria-pressed="${image?.value===url}"><img src="${h(url)}" alt="Opção de foto ${i+1}" referrerpolicy="no-referrer"></button>`).join('');picker.hidden=info.images.length<2;}
 }
 renderPreviewCard(form,info.source);
}
function renderPreviewCard(form,source=''){
 renderProductFieldStatus(form);
 const card=form.querySelector('[data-preview-card]');
 if(!card)return;
 const title=safeText(form.querySelector('[name="name"]')?.value,180);
 const image=safeImage(form.querySelector('[name="image"]')?.value);
 const category=String(form.querySelector('[name="category"]')?.value||'Outros');
 card.innerHTML=`<div class="mini-preview-image">${image?`<img src="${h(image)}" alt="Imagem encontrada do produto" loading="lazy" referrerpolicy="no-referrer">`:`<span aria-hidden="true">${categoryIcon(category)}</span>`}</div><div class="mini-preview-text"><span>PRÉVIA DA VITRINE ${source?'· '+h(source):''}</span><strong>${h(title||'Seu produto aparecerá aqui')}</strong><small>${image?'✓ Imagem encontrada — você pode alterá-la abaixo.':'A imagem aparece aqui assim que for encontrada.'}</small></div>`;
 const photo=card.querySelector('img');
 if(photo)photo.onerror=()=>{form.dataset.photoFailed=image;renderProductFieldStatus(form);photo.remove();const ph=card.querySelector('.mini-preview-image');if(ph)ph.textContent='▣';const status=form.querySelector('[data-preview-status]');if(status){status.textContent='A foto encontrada não abriu. Tente outra imagem ou cole o endereço da foto.';status.dataset.status='warning';}const help=form.querySelector('[data-photo-help]');if(help)help.hidden=false;};
}
function previewLink(form){return extractShopeeLink(form.elements.originalUrl?.value)||extractShopeeLink(form.elements.affiliateUrl.value);}
async function resolveProductPreview(form,url,seq,force=false){
 const status=form.querySelector('[data-preview-status]');
 if(status){status.textContent='Lendo a página para buscar nome, foto, preço e descrição…';status.dataset.status='loading';}
 try{
  const info=await lookupProductPreview(url,force);
  if(seq!==previewSequence||!form.isConnected||previewLink(form)!==url)return;
  fillProductPreview(form,info);
  const missing=productFieldStatus(form).filter(item=>!item.ready).map(item=>item.name.toLocaleLowerCase('pt-BR'));
  if(status){status.textContent=(missing.length?'Leitura concluída. Não foi possível preencher: '+missing.join(', ')+'. Confira os campos antes de salvar.':'Nome, foto, preço e descrição preenchidos. Confira e salve.')+(info.readNote?' '+info.readNote:'');status.dataset.status=missing.length||info.readNote?'warning':'success';}
  const help=form.querySelector('[data-photo-help]');if(help)help.hidden=!!info.image;
 }catch(error){
  if(seq!==previewSequence||!form.isConnected||previewLink(form)!==url)return;
  fillProductPreview(form,{name:guessNameFromLink(url),image:'',source:''});
  if(status){status.textContent=error.message||'Não foi possível ler os dados da página. Tente novamente com o link completo do produto.';status.dataset.status='warning';}
  const help=form.querySelector('[data-photo-help]');if(help)help.hidden=false;const details=form.querySelector('.easy-extra');if(details)details.open=true;
 }
}
function scheduleProductPreview(form,immediate=false){
 clearTimeout(previewTimer);
 const seq=++previewSequence;
 const affiliate=extractShopeeLink(form.elements.affiliateUrl.value);
 const url=previewLink(form);
 const status=form.querySelector('[data-preview-status]');
 const detected=form.querySelector('[data-link-detected]');
 if(detected){detected.textContent=affiliate?'Link identificado: '+affiliate:'';detected.hidden=!affiliate;}
 if(form.dataset.previewUrl!==url){
  for(const name of ['name','image','price','description']){const input=form.querySelector('[name="'+name+'"]');if(input?.dataset.autofilled==='1'){input.value='';delete input.dataset.autofilled;}}
  const picker=form.querySelector('[data-photo-picker]');if(picker){picker.innerHTML='';picker.hidden=true;}
  delete form.dataset.photoFailed;showProductPriceNote(form,'');
  form.dataset.previewUrl=url;renderPreviewCard(form);
 }
 if(!url){if(status){status.textContent=form.elements.affiliateUrl.value?'Não encontrei um link da Shopee nesta mensagem. Copie o link novamente.':'Cole um link ou a mensagem compartilhada pela Shopee.';status.dataset.status='idle';}return;}
 const shared=productTools.parseSharedProduct(form.elements.affiliateUrl.value);
 fillProductPreview(form,{name:shared.name||guessNameFromLink(url),price:shared.price,image:'',source:shared.name?'mensagem compartilhada':''});
 previewTimer=setTimeout(()=>resolveProductPreview(form,url,seq,immediate),immediate?0:550);
}

function shareText(name,url){return `Olha essa seleção de produtos! 🛍️\n${name}\n${url}`;}
function shareButtons(uid,name){
 const url=shopUrl(uid),encoded=encodeURIComponent(shareText(name,url));
 return `<div class="share-buttons"><button class="btn btn-white btn-sm" type="button" data-action="copy" data-url="${h(url)}">⧉ Copiar link</button><a class="btn btn-share-whatsapp btn-sm" href="https://wa.me/?text=${encoded}" target="_blank" rel="noopener noreferrer">WhatsApp</a><button class="btn btn-orange btn-sm" type="button" data-action="share-shop" data-url="${h(url)}" data-name="${h(name)}">↗ Compartilhar</button></div>`;
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
function productCard(p,admin=false){
 const link=validShopee(p.affiliateUrl)?p.affiliateUrl:'';
 return `<article class="product-card">${productPhoto(p)}<div class="product-card-body"><span class="pill orange">${h(p.category||'Outros')}</span><strong class="product-card-title">${h(p.name)}</strong>${p.description?`<p class="product-card-meta">${h(p.description)}</p>`:''}<div class="product-price ${p.price==null?'muted':''}">${p.price!=null?money(p.price):'Consulte o preço na Shopee'}</div><div class="product-card-actions">${link?`<a href="${h(link)}" class="btn btn-orange btn-sm" target="_blank" rel="noopener noreferrer sponsored">Ver na Shopee</a>`:'<span>Link indisponível</span>'}<button class="btn btn-white btn-sm" data-action="share-product" data-id="${h(p.id)}">Compartilhar</button></div>${admin?`<div class="card-tools">${p.trackingSource!=='api'?`<button class="btn btn-white btn-sm" data-action="edit-product" data-id="${h(p.id)}">Editar</button>`:''}<button class="btn btn-white btn-sm" data-action="copy-product" data-id="${h(p.id)}">Copiar oferta</button><button class="btn btn-outline btn-sm" data-action="remove-product" data-id="${h(p.id)}" aria-label="Excluir ${h(p.name)}">Excluir</button></div>`:''}<small class="product-note">Preço e disponibilidade podem mudar. Compra na Shopee.</small></div></article>`;
}

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
  <div><span class="guide-count">2</span><p>No aplicativo ou navegador, toque em <strong>Compartilhar Copiar link</strong> e cole abaixo.</p></div>
  <div><span class="guide-count">3</span><p>Se o endereço mostrar <code>/shop/123456789</code> ou <code>?shopid=123456789</code>, o número é o ID. Se mostrar somente o nome da loja, não é possível garantir o ID por esse link.</p></div>
 </div>
 <form data-form="find-shop-id" class="guide-checker">
  <label class="form-control"><span class="form-label">Cole aqui o link da loja</span><input class="field" name="shopLink" type="url" required placeholder="https://shopee.com.br/q63ifc2_ce" autocomplete="off" aria-label="Link da loja Shopee"></label>
  <button class="btn btn-orange" type="submit">Verificar link</button>
 </form>
 <div class="guide-result" data-shop-id-result role="status" aria-live="polite">Exemplo: no link <code>shopee.com.br/q63ifc2_ce</code>, <strong>q63ifc2_ce</strong> é o nome do perfil, não um ID numérico.</div>
 <details class="simple-details"><summary>Não apareceu o número? Veja alternativas</summary>
  <p>Na <a class="text-link" href="https://seller.shopee.com.br" target="_blank" rel="noopener noreferrer">Central do Vendedor</a>, procure <strong>Perfil da Loja Visualizar minha loja</strong> e confira o endereço. Em algumas páginas o ID aparece após <code>/shop/</code> ou <code>shopid=</code>; em outras, aparece só o nome de usuário. Se o ID for indispensável para uma integração específica, consulte o suporte oficial da Shopee.</p>
  <p><strong>Não confunda:</strong> ID da loja = número da loja do vendedor; App ID + Secret = credenciais da API de Afiliados; ID do afiliado = identificador da conta de afiliado. Um não substitui o outro.</p>
  <p>Para ganhar comissão, gere o <strong>link de afiliado</strong> na sua conta, no menu <strong>Conta Link de Conversão</strong> (app) ou <strong>Oferta Link Personalizado</strong> (portal). <a class="text-link" href="https://help.shopee.com.br/portal/10/article/128461-Como-gerar-links-de-produtos-ou-lojas" target="_blank" rel="noopener noreferrer">Instruções oficiais da Shopee</a>.</p>
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

function home(){const shown=state.shops.filter(s=>(s.name+' '+s.description).toLowerCase().includes(state.homeQuery.toLowerCase()));return `<section class="hero"><div class="container"><div class="hero-panel"><div class="hero-content"><span class="eyebrow">✦ Sua loja, suas indicações</span><h1>Crie sua vitrine de afiliados <span class="brand-accent">em 3 passos.</span></h1><p>Cole o link da Shopee, confira seu produto e compartilhe sua seleção em um só lugar.</p><div class="hero-actions"><button class="btn btn-orange" data-action="start-store">Criar minha vitrine gratuita</button><a href="#/como-funciona" class="btn btn-white">Como funciona</a></div></div><div class="hero-art" aria-hidden="true"><div class="dots-bg"></div><div class="hero-orbit"></div><div class="hero-orbit small"></div><div class="hero-illustration"><span>✓</span></div><div class="floating-card">✦ Sua vitrine online</div><div class="floating-card second">Compras na Shopee</div></div></div></div></section><section class="section"><div class="container"><div class="section-heading"><div><span class="eyebrow">Descubra</span><h2>Vitrines para explorar</h2><p>Seleções de afiliados reais que você pode visitar sem precisar de conta.</p></div><span class="pill gray">${state.shops.length} ${state.shops.length===1?'vitrine pública':'vitrines públicas'}</span></div><form class="searchbar" data-form="search-home" style="margin-bottom:22px"><span class="searchbar-icon">⌕</span><input name="search" placeholder="Pesquisar uma vitrine ou uma categoria..." value="${h(state.homeQuery)}" aria-label="Buscar vitrines"><button class="btn btn-orange btn-sm">Buscar</button></form>${state.publicError?alertBox('warning',h(state.publicError)):''}${shown.length?`<div class="shop-grid">${shown.map(s=>`<a class="shop-card" href="#/loja/${encodeURIComponent(s.ownerUid)}"><div class="shop-card-top"><div class="store-logo">${h(initials(s.name))}</div><div><span class="pill orange">Vitrine pública</span><h3 style="margin-top:6px">${h(s.name)}</h3></div></div><p>${h(s.description||'Produtos selecionados por um afiliado.')}</p><div class="shop-card-bottom"><span>${Number(s.productCount)||0} produtos</span><span class="text-link">Visitar vitrine</span></div></a>`).join('')}</div>`:empty('▦',state.homeQuery?'Nenhuma vitrine encontrada':'As primeiras vitrines aparecerão aqui',state.homeQuery?'Tente pesquisar por outro termo.':'Entre com Google e crie a primeira vitrine pública da plataforma.',`<button class="btn btn-orange" data-action="start-store">Criar minha vitrine</button>`)}</div></section><section class="section"><div class="container"><div class="section-heading"><div><span class="eyebrow">Simples para quem vende e quem compra</span><h2>Tudo no mesmo lugar</h2></div></div><div class="feature-grid"><article class="feature-card"><div class="feature-icon">⌕</div><h3>Busque produtos</h3><p>Pesquise produtos na Shopee e copie o seu próprio link de afiliado. A API é opcional.</p></article><article class="feature-card"><div class="feature-icon">▤</div><h3>Tenha sua loja pública</h3><p>Compartilhe um endereço exclusivo. Qualquer pessoa pode ver seus produtos e comprar diretamente na Shopee.</p></article><article class="feature-card"><div class="feature-icon">◴</div><h3>Veja suas comissões</h3><p>Veja as comissões quando ativar a API de afiliados; sem ela, consulte o portal oficial.</p></article></div></div></section>`;}
function how(){return `<section class="section"><div class="container" style="padding-top:32px">
 <div class="page-header"><div><span class="eyebrow">Guia simples</span><h1>Comece em três passos</h1><p>Você não precisa localizar o ID da loja ou conectar uma API para publicar links de afiliado já convertidos.</p></div></div>
 <div class="feature-grid">
  <article class="feature-card"><div class="feature-icon">1</div><h3>Entre com Google</h3><p>Sua vitrine pública é criada automaticamente com o nome do seu perfil.</p></article>
  <article class="feature-card"><div class="feature-icon">2</div><h3>Copie seu link de afiliado</h3><p>Abra a Shopee Afiliados, escolha um produto e gere seu link em Link de Conversão. Depois cole o link e o título do produto no painel.</p></article>
  <article class="feature-card"><div class="feature-icon">3</div><h3>Divulgue sua loja</h3><p>Copie o endereço da vitrine e envie aos clientes. Eles compram diretamente na Shopee, com o link que você publicou.</p></article>
 </div>
 <div class="form-actions" style="margin:22px 0"><button class="btn btn-orange" data-action="start-store">Criar minha vitrine</button><a class="btn btn-white" target="_blank" rel="noopener noreferrer" href="https://help.shopee.com.br/portal/10/article/128461-Como-gerar-links-de-produtos-ou-lojas">Como gerar links oficiais</a></div>
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
function sidebar(){const items=[['painel','▦','Início'],['adicionar','＋','Adicionar'],['produtos','▤','Produtos'],['configuracoes','⚙','Minha loja']];const u=state.user;return `<aside class="sidebar"><div class="side-profile"><span class="avatar">${h(initials(u?.displayName))}</span><div><strong>${h(u?.displayName||'Minha conta')}</strong><small>Sua vitrine</small></div></div><nav class="side-nav" aria-label="Sua vitrine">${items.map(([id,icon,label])=>`<a href="#/${id}" class="${state.route===id?'active':''}" ${state.route===id?'aria-current="page"':''}><span class="side-icon">${icon}</span>${label}</a>`).join('')}</nav><div class="sidebar-bottom">Vitrine Livre</div></aside>`;}

function adminPage(body){return `<div class="container layout">${sidebar()}<div class="dashboard-main">${state.ownerError?alertBox('danger',`<strong>Configuração do Realtime Database pendente.</strong> ${h(state.ownerError)} <a href="https://console.firebase.google.com/project/gahepatama-4707c/database" target="_blank" rel="noopener noreferrer">Abrir Firebase</a>`):''}${body}</div></div>`;}
function adminHead(title,desc,actions=''){return `<div class="page-header"><div><span class="eyebrow">Área do afiliado</span><h1>${h(title)}</h1><p>${h(desc)}</p></div><div class="page-header-actions">${actions}</div></div>`;}
function metric(label,value,icon,detail){return `<div class="metric"><div class="metric-icon">${icon}</div><div class="metric-label">${h(label)}</div><div class="metric-value">${value}</div><div class="metric-detail">${h(detail)}</div></div>`;}
function adminHome(){
 const s=state.shop;
 return adminPage(adminHead('Minha vitrine','Adicione seus achados e compartilhe com quem quiser.',`<a href="#/adicionar" class="btn btn-orange">Adicionar produto</a>`)
 +`<div class="dashboard-summary"><div><span class="eyebrow">${s?.isPublic?'VITRINE PÚBLICA':'VITRINE PRIVADA'}</span><h2>${h(s?.name||'Minha vitrine')}</h2><p>${state.myProducts.length} ${state.myProducts.length===1?'produto':'produtos'} na sua seleção</p></div><a href="#/loja/${encodeURIComponent(state.user.uid)}" class="btn btn-white">Ver vitrine</a></div>
 ${s?.isPublic?`<div class="panel"><h3>Seu link, pronto para compartilhar</h3><div class="sharing"><div class="share-line"><input readonly aria-label="Link da minha vitrine" value="${h(shopUrl(s.ownerUid))}"><button class="btn btn-white" data-action="copy" data-url="${h(shopUrl(s.ownerUid))}">Copiar</button></div>${shareButtons(s.ownerUid,s.name)}</div></div>`:alertBox('info','Sua vitrine está privada. Ative o acesso público em <a href="#/configuracoes">Minha loja</a> para compartilhar a seleção.')}
 ${state.myProducts.length?`<div class="section-heading"><h2>Seus últimos produtos</h2><a href="#/produtos" class="text-link">Ver todos</a></div><div class="manage-product-grid">${state.myProducts.slice(0,4).map(p=>productCard(p,true)).join('')}</div>`:empty('＋','Vamos adicionar seu primeiro produto?','Na Shopee, toque em Compartilhar, copie a mensagem e cole aqui.','<a href="#/adicionar" class="btn btn-orange">Colar meu primeiro link</a>')}`);
}

function catalog(){return adminPage(adminHead('Buscar produtos','Pesquise diretamente na Shopee ou pela sua API de afiliados, quando conectada.','<a href="#/adicionar" class="btn btn-white btn-sm">Tenho um link da Shopee</a>')+(!state.connected?alertBox('warning','<strong>Busca disponível.</strong> Pesquise diretamente na Shopee e adicione o link que você converteu no programa de afiliados. Para resultados integrados e geração automática, conecte a API em <a href="#/configuracoes">Configurações</a>.'):alertBox('info','Os produtos vêm da API de afiliados. Ao adicionar, o sistema gera um link associado às suas credenciais e publica em sua vitrine.'))+`<div class="panel"><div class="panel-title"><h3>Pesquisar catálogo Shopee</h3><span class="pill orange">${state.connected?'API de afiliados':'Busca externa Shopee'}</span></div><form class="search-tool" data-form="search-offers"><div class="searchbar"><span class="searchbar-icon">⌕</span><input name="keyword" value="${h(state.offerQuery)}" placeholder="Ex.: fone bluetooth, air fryer, camiseta..." aria-label="Busca de ofertas Shopee" required minlength="2"><button class="btn btn-orange btn-sm">${state.connected?'Buscar ofertas':'Buscar na Shopee'}</button></div></form>${state.loadingOffers?loading('Buscando ofertas da Shopee...'):(state.offers.length?`<div style="margin-bottom:14px" class="result-count">${state.offers.length} ofertas encontradas ${state.offerPage>1?'· página '+state.offerPage:''}</div><div class="product-grid">${state.offers.map(offerCard).join('')}</div>${state.offerNext?`<div style="text-align:center;margin-top:18px"><button data-action="more-offers" class="btn btn-white">Carregar mais ofertas</button></div>`:''}`:empty('⌕','Encontre produtos para sua vitrine',state.connected?'Digite o nome de um produto e clique em Buscar ofertas.':'Pesquise na Shopee sem integração e publique links já convertidos no programa de afiliados.',`<a href="#/adicionar" class="btn btn-white">Adicionar pelo link</a>`))}</div>`);}
function addManual(){
 const item=state.myProducts.find(p=>p.id===state.editId)||{};
 const edit=!!item.id;
 const received=!edit&&validShopee(receivedLink)?receivedLink:'';
 if(received)setTimeout(()=>{const form=app.querySelector('[data-form="manual-product"]');if(form&&form.elements.affiliateUrl.value===received)scheduleProductPreview(form,true);},0);
 return adminPage(adminHead(edit?'Editar produto':'Adicionar produto','Cole o link para preencher foto, preço e descrição. Depois confira e salve.',`<a href="#/produtos" class="btn btn-white">Ver produtos</a>`)+`
 <div class="panel add-easy-panel"><form data-form="manual-product" class="easy-product-form" data-preview-url="${h(item.originalUrl||item.affiliateUrl||'')}">
 <input type="hidden" name="editId" value="${h(item.id||'')}">
 <div class="capture-url"><label class="form-control"><span class="form-label">Link ou mensagem da Shopee *</span><textarea name="affiliateUrl" class="field shared-input" rows="3" required maxlength="6000" placeholder="Cole aqui o link ou toda a mensagem de Compartilhar da Shopee" aria-describedby="preview-status">${h(item.affiliateUrl||received||'')}</textarea></label><button type="button" class="btn btn-white" data-action="paste-link">Colar</button><button type="button" class="btn btn-orange" data-action="retry-preview">Buscar dados</button></div>
 <small class="link-detected" data-link-detected hidden></small>
 <p class="hint">Use seu link de afiliado para manter a atribuição. A leitura automática consulta a página do produto pelo serviço Microlink.</p>
 <p id="preview-status" class="preview-status" data-preview-status data-status="idle" role="status" aria-live="polite">${edit?'Edite os dados ou consulte novamente a página do produto.':'Ao colar o link, buscamos nome, foto, preço e descrição automaticamente.'}</p>
 <div class="import-fields" data-import-fields aria-label="Campos do produto"><span class="import-field" data-ready="${!!item.name}">Nome</span><span class="import-field" data-ready="${!!safeImage(item.image)}">Foto</span><span class="import-field" data-ready="${item.price!=null}">Preço</span><span class="import-field" data-ready="${!!item.description}">Descrição</span></div>
 <div class="easy-preview-layout"><div class="mini-preview" data-preview-card><div class="mini-preview-image">${safeImage(item.image)?`<img src="${h(safeImage(item.image))}" alt="Foto atual" referrerpolicy="no-referrer">`:'<span>▣</span>'}</div><div class="mini-preview-text"><span>PRÉVIA</span><strong>${h(item.name||'Seu produto aparecerá aqui')}</strong><small>Confira a foto antes de salvar.</small></div></div><div class="easy-title"><label class="form-control"><span class="form-label">Nome do produto *</span><input name="name" class="field" value="${h(item.name||'')}" required maxlength="180" placeholder="Ex.: Fone Bluetooth sem fio"></label><label class="form-control"><span class="form-label">Preço (opcional)</span><input name="price" class="field" inputmode="decimal" value="${item.price==null?'':h(String(item.price).replace('.',','))}" placeholder="R$ 129,90" aria-describedby="price-import-note"><small id="price-import-note" class="price-import-note" data-price-note hidden></small></label></div></div>
 <label class="form-control description-preview"><span class="form-label">Descrição do produto</span><textarea name="description" maxlength="350" rows="4" class="field field-area" placeholder="A descrição da página será preenchida aqui">${h(item.description||'')}</textarea><small class="hint">Resumo de até 350 caracteres da descrição encontrada. Você pode ajustar antes de salvar.</small></label>
 <div class="photo-picker" data-photo-picker hidden aria-label="Fotos encontradas"></div>
 <div class="photo-help" data-photo-help hidden><strong>Algum dado não apareceu?</strong><p>A Shopee pode limitar a leitura da página. Abra o produto e copie seu endereço completo para o campo abaixo. Seu link de afiliado será preservado. Também é possível colar o endereço HTTPS de uma foto.</p></div>
 <details class="simple-details easy-extra"><summary>Ajustar foto e outros detalhes</summary><div class="form-grid">
 <label class="form-control span-2"><span class="form-label">Endereço da foto</span><input name="image" type="url" class="field" maxlength="1400" value="${h(item.image||'')}" placeholder="https://.../foto.jpg"><span class="hint">No computador, use “Copiar endereço da imagem” na foto do produto.</span></label>
 <label class="form-control span-2"><span class="form-label">Link completo do produto para ler os dados</span><input name="originalUrl" type="url" class="field" maxlength="1200" value="${h(item.originalUrl&&item.originalUrl!==item.affiliateUrl?item.originalUrl:'')}" placeholder="https://shopee.com.br/produto-i.123.456"><span class="hint">Opcional. Não substitui seu link de afiliado.</span></label>
 <label class="form-control"><span class="form-label">Categoria</span><select name="category" class="field">${categories.slice(1).map(x=>`<option value="${h(x)}" ${(item.category||'Outros')===x?'selected':''}>${h(x)}</option>`).join('')}</select></label>
 </div></details><div class="easy-submit"><span>${state.shop?.isPublic?'O produto ficará na sua vitrine pública.':'Sua vitrine está privada.'}</span><button type="submit" class="btn btn-orange btn-primary-action">${edit?'Salvar alterações':'Salvar produto'}</button></div>
 </form></div><p class="hint">Ainda não tem o link? <a class="text-link" href="#/catalogo">Pesquisar na Shopee</a></p>`);
}
function adminProducts(){
 const query=state.productQuery.toLocaleLowerCase('pt-BR');
 const products=state.myProducts.filter(p=>(p.name+' '+p.category).toLocaleLowerCase('pt-BR').includes(query));
 const saved=state.myProducts.find(p=>p.id===state.lastSavedId);
 return adminPage(adminHead('Meus produtos','Edite e compartilhe suas ofertas.',`<a href="#/adicionar" class="btn btn-orange">Adicionar produto</a>`)+`${saved?`<div class="saved-banner" role="status"><strong>Produto salvo!</strong><button class="btn btn-orange" data-action="share-product" data-id="${h(saved.id)}">Compartilhar agora</button><a href="#/adicionar" class="btn btn-white">Adicionar outro</a></div>`:''}<form class="product-toolbar searchbar" data-form="search-products"><input name="search" class="field" placeholder="Buscar seus produtos" aria-label="Buscar seus produtos" value="${h(state.productQuery)}"><button class="btn btn-white">Buscar</button>${state.productQuery?'<button type="button" class="btn btn-white" data-action="clear-product-search">Limpar</button>':''}</form>${products.length?`<div class="manage-product-grid">${products.map(p=>productCard(p,true)).join('')}</div>`:empty('▤',state.productQuery?'Nenhum resultado':'Nenhum produto ainda',state.productQuery?'Tente outro nome ou categoria.':'Cole seu primeiro link e comece sua seleção.',state.productQuery?'':'<a href="#/adicionar" class="btn btn-orange">Adicionar produto</a>')}`);
}

function finance(){const r=state.report?.summary;const days=state.report?.days||30;return adminPage(adminHead('Minhas comissões','Acompanhe os resultados disponíveis na sua API de Afiliados Shopee.',`<button class="btn btn-orange btn-sm" data-action="load-report" data-days="30">↻ Consultar Shopee</button>`)+alertBox('info','Os números abaixo são <strong>conversões e comissões reportadas pela API</strong>. Não representam dinheiro disponível para saque; valores estimados podem mudar até a validação e não incluem necessariamente todos os períodos.')+(!state.connected?alertBox('warning','Conecte sua API de afiliados em <a href="#/configuracoes">Configurações</a> para consultar valores reais.'):state.reportError?alertBox('danger',h(state.reportError)):'')+`<div class="report-band"><span class="eyebrow white">COMISSÃO ESTIMADA · ÚLTIMOS ${days} DIAS</span><strong>${r?money(r.total):'—'}</strong><p>${r?'Valor informado pelo relatório de conversões da Shopee.':'Clique em Consultar Shopee para carregar os valores da sua conta.'}</p>${r?`<div class="report-bars"><span style="width:${Math.min(100,r.total>0?r.completed/r.total*100:0)}%"></span><span style="width:${Math.min(100,r.total>0?r.pending/r.total*100:0)}%"></span></div><small>Concluídos e pendentes classificados por status de pedidos; alguns pedidos podem misturar status.</small>`:''}</div><div class="metric-grid">${metric('Estimadas na vitrine',r?money(r.siteTotal):'—','◎','Com identificação SubId shopeepanel')}${metric('Pedidos informados',r?String(r.orders):'—','▤','Janela do relatório')}${metric('Comissões concluídas',r?money(r.completed):'—','✓','Ainda sujeitas à validação')}${metric('Conversões únicas',r?String(r.conversions):'—','◴','Registros encontrados na API')}</div><div class="panel"><div class="panel-title"><h3>Sobre os números</h3><span class="pill orange">Transparência</span></div><p>O total da conta inclui as conversões reportadas pela Shopee nos últimos ${days} dias. A comissão atribuída a esta vitrine considera a marcação SubId dos links gerados aqui. Links adicionados manualmente podem não ser identificados como vendas desta vitrine.</p><div class="form-actions"><button class="btn btn-white" data-action="load-report" data-days="7">Últimos 7 dias</button><button class="btn btn-white" data-action="load-report" data-days="30">Últimos 30 dias</button></div>${r?`<div class="status-row">${r.partial?'⚠ O relatório pode estar incompleto por limite de paginação.':'✓ Relatório consultado em '+formattedDate(state.report.consultedAt)}</div>`:''}</div>`);}
function settings(){const s=state.shop||{};return adminPage(adminHead('Minha loja','Personalize sua vitrine. O ID numérico da Shopee não é obrigatório.')
 +`<div class="panel"><div class="panel-title"><h3>Dados públicos da vitrine</h3><span class="pill green">Fácil de editar</span></div>
 <form data-form="store-settings"><div class="form-grid">
 <label class="form-control span-2"><span class="form-label">Nome da minha vitrine *</span><input class="field" name="name" required maxlength="70" value="${h(s.name||'Minha vitrine')}"></label>
 <label class="form-control span-2"><span class="form-label">Descrição</span><textarea name="description" class="field field-area" maxlength="240">${h(s.description||'')}</textarea></label>
 <label class="form-control span-2"><span class="form-label">Link da loja Shopee (opcional)</span><input class="field" name="referenceUrl" type="url" value="${h(s.referenceUrl||'')}" placeholder="https://shopee.com.br/q63ifc2_ce"><span class="hint">Na Shopee, abra o perfil da loja Compartilhar Copiar link. Basta o endereço; o número da loja não é necessário.</span></label>
 </div><label class="public-toggle"><input type="checkbox" name="isPublic" ${s.isPublic!==false?'checked':''}> Permitir que qualquer visitante veja minha vitrine</label><div class="form-actions"><button class="btn btn-orange" type="submit">Salvar alterações</button></div></form>
 ${s.ownerUid?`<div class="sharing"><label>MEU LINK PÚBLICO</label><div class="share-line"><input readonly value="${h(shopUrl(s.ownerUid))}" aria-label="Link público"><button class="btn btn-orange btn-sm" data-action="copy" data-url="${h(shopUrl(s.ownerUid))}">Copiar</button></div>${shareButtons(s.ownerUid,s.name)}</div>`:''}</div>
 <details class="simple-details guide-disclosure"><summary>Como encontrar o ID da loja Shopee? (opcional)</summary>${shopIdGuide()}</details>
 <details class="panel advanced-section"><summary>Integração avançada: API Shopee e comissões <span class="pill ${state.connected?'green':'gray'}">${state.connected?'Conectada':'Opcional'}</span></summary>
  <p>Você <strong>não precisa</strong> desta integração para criar a vitrine, adicionar seus links e compartilhá-la. Ela serve para procurar ofertas pela API, gerar links automaticamente e consultar comissões. Requer backend Firebase configurado.</p>
  ${state.connected?`<div class="connected"><strong>✓ API de afiliados vinculada</strong></div><div class="form-actions"><button class="btn btn-outline" data-action="disconnect">Desconectar API</button></div>`:`<form data-form="affiliate-connect"><div class="form-grid">
   <label class="form-control span-2"><span class="form-label">App ID da Open API de Afiliados</span><input name="appId" class="field" required minlength="3" maxlength="100" autocomplete="off" placeholder="Obtido no portal de afiliados"></label>
   <label class="form-control span-2"><span class="form-label">Secret da Open API (não é sua senha da Shopee)</span><input name="secret" type="password" class="field" required minlength="6" maxlength="300" autocomplete="new-password" placeholder="Chave secreta da API"></label>
  </div><div class="form-actions"><button type="submit" class="btn btn-orange">Conectar API</button><a class="text-link" href="https://affiliate.shopee.com.br/open_api" target="_blank" rel="noopener noreferrer">Onde conseguir App ID e Secret</a></div></form>`}
  <div class="form-actions"><a href="#/catalogo" class="btn btn-white">Buscar ofertas</a><a href="#/financeiro" class="btn btn-white">Consultar comissões</a></div><p class="hint">O ID numérico da loja é diferente do App ID, da senha da API e do ID de afiliado. O Gmail não vincula automaticamente a sua conta Shopee.</p>
 </details>
 <div class="panel"><h3>Conta</h3><p>O login Google protege a edição da sua vitrine. Seus visitantes não precisam entrar para comprar.</p><div class="form-actions"><button class="btn btn-white" data-action="logout">Sair da conta Google</button></div></div>`);}
function authNeeded(){return `<div class="container"><div class="auth-card"><div class="empty-icon">◈</div><span class="eyebrow">Acesso do afiliado</span><h2>Entre para criar sua vitrine</h2><p>Use sua conta Google para salvar produtos e compartilhar sua vitrine.</p><button class="btn btn-google" data-action="login"><span class="google-g">G</span> Continuar com Google</button><div class="alert info" style="margin-top:20px;text-align:left;font-size:12px">Depois de entrar, basta colar seu link de afiliado da Shopee.</div></div></div>`;}
function render(){renderTop();const restricted=['painel','catalogo','adicionar','produtos','financeiro','configuracoes'];if(!state.authReady){app.innerHTML=loading('Preparando sua vitrine...');return;}if(restricted.includes(state.route)&&!state.user){app.innerHTML=authNeeded();return;}if(state.route==='loja'){app.innerHTML=store();return;}if(state.route==='como-funciona'){app.innerHTML=how();return;}if(state.route==='ajuda-id'){app.innerHTML=`<div class="container section help-page"><div class="page-header"><div><span class="eyebrow">Ajuda Shopee</span><h1>Encontre o link ou ID da loja</h1><p>Sem complicação e sem precisar fazer login.</p></div></div>${shopIdGuide()}<div class="form-actions"><a class="btn btn-orange" href="#/como-funciona">Como criar minha vitrine</a></div></div>`;return;}if(restricted.includes(state.route)&&state.loading){app.innerHTML=loading('Carregando painel...');return;}switch(state.route){case 'painel':app.innerHTML=adminHome();break;case 'catalogo':app.innerHTML=catalog();break;case 'adicionar':app.innerHTML=addManual();break;case 'produtos':app.innerHTML=adminProducts();break;case 'financeiro':app.innerHTML=finance();break;case 'configuracoes':app.innerHTML=settings();break;default:app.innerHTML=home();}}
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

async function onRoute(){closeShareDialog();clearTimeout(previewTimer);++previewSequence;const {route,id}=parseRoute();state.editId=route==='adicionar'?id:'';if(route!=='loja')document.title='Vitrine Livre | Sua loja de afiliados';state.route=route;state.routeId=id;state.storeQuery='';state.category='Tudo';if(!state.authReady){render();return;}if(route==='loja'){await fetchStore(id);return;}render();if(route==='home'&&!state.shops.length)await fetchPublicShops();}
async function logIn(){try{const p=new GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});await signInWithPopup(auth,p);location.hash=receivedLink?'#/adicionar':'#/painel';}catch(error){const code=error?.code||'';let msg=errText(error);if(code.includes('unauthorized-domain'))msg='Autorize perabru.github.io no Firebase Authentication Settings Authorized domains.';else if(code.includes('operation-not-allowed'))msg='Ative o provedor Google em Firebase Authentication Sign-in method.';else if(code.includes('popup-closed-by-user'))return;toast(msg,true);}}
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
 if(type==='search-products'){state.productQuery=String(values.search||'').trim();render();return;}
 if(type==='search-home'){state.homeQuery=String(values.search||'').trim();render();return;}
 if(type==='search-store'){state.storeQuery=String(values.search||'').trim();render();return;}
  if(type==='find-shop-id'){updateShopIdResult(form);return;}
 if(type==='search-offers'){
  const keyword=String(values.keyword||'').trim();if(keyword.length<2){toast('Digite pelo menos duas letras para pesquisar.',true);return;}
  await loadOffers(keyword,1);return;
 }
 if(form.dataset.saving==='1')return;form.dataset.saving='1';
 formBusy(form,true);
 try{
  if(type==='manual-product'){
   state.lastSavedId=await saveManualProduct(values);
   receivedLink='';try{sessionStorage.removeItem('vitrine-received-link');}catch{}
   state.editId='';state.productQuery='';
   toast('Produto salvo. Sua oferta está pronta para compartilhar.');
   await refreshOwn();await fetchPublicShops();location.hash='#/produtos';
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
 }catch(error){toast(errText(error),true);}finally{delete form.dataset.saving;if(form.isConnected)formBusy(form,false);}
});

app.addEventListener('input',event=>{
 const form=event.target.closest('form[data-form="manual-product"]');
 if(!form)return;
 if(['affiliateUrl','originalUrl'].includes(event.target.name))scheduleProductPreview(form);
 if(['name','image','price','description','category'].includes(event.target.name)){
  if(event.target.dataset)event.target.dataset.autofilled='0';
  if(event.target.name==='price')showProductPriceNote(form,'Preço editado por você.');
  if(event.target.name==='image')delete form.dataset.photoFailed;
  renderPreviewCard(form);
 }
});

function findProduct(id){const list=state.route==='loja'?state.publicProducts:state.myProducts;return list.find(p=>p.id===id);}
function productShareText(p){return `${p.name}${p.price!=null?'\n'+money(p.price):''}\n${p.affiliateUrl}`;}
let shareFocus=null;
function closeShareDialog(){const modal=$('modal');if(!modal||modal.hidden)return;modal.hidden=true;modal.innerHTML='';document.body.style.overflow='';shareFocus?.focus?.();shareFocus=null;}
async function copyText(text){try{await navigator.clipboard.writeText(text);toast('Copiado! Cole onde quiser compartilhar.');return true;}catch{toast('Não foi possível copiar automaticamente. Selecione o texto e copie.',true);return false;}}
function openShareDialog(p){
 if(!p||!validShopee(p.affiliateUrl))return;
 shareFocus=document.activeElement;
 const modal=$('modal'),message=productShareText(p);
 modal.innerHTML=`<section class="dialog-card" role="dialog" aria-modal="true" aria-labelledby="share-title"><div class="dialog-head"><h2 id="share-title">Compartilhar produto</h2><button class="btn btn-white" data-action="close-dialog" aria-label="Fechar">✕</button></div><div class="dialog-body"><p>Nome, preço e seu link de afiliado, prontos para enviar.</p><label class="form-control"><span class="form-label">Mensagem da oferta</span><textarea class="field share-message" id="share-message" rows="5">${h(message)}</textarea></label><div class="dialog-actions"><button class="btn btn-orange" data-action="native-share-product" data-id="${h(p.id)}">Compartilhar</button><button class="btn btn-white" data-action="copy-message">Copiar mensagem</button><button class="btn btn-share-whatsapp" data-action="whatsapp-product">WhatsApp</button></div><small>O envio é confirmado no aplicativo que você escolher.</small></div></section>`;
 modal.hidden=false;document.body.style.overflow='hidden';modal.querySelector('button')?.focus();
}
document.addEventListener('keydown',event=>{
 const modal=$('modal');if(!modal||modal.hidden)return;
 if(event.key==='Escape'){closeShareDialog();return;}
 if(event.key==='Tab'){const all=[...modal.querySelectorAll('button,a[href],textarea,input')].filter(el=>!el.disabled);const first=all[0],last=all.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
});
document.addEventListener('click',async(event)=>{
 const el=event.target.closest('[data-action]');if(!el)return;
 const action=el.dataset.action;
 if(action==='close-dialog'){closeShareDialog();return;}
 if(action==='edit-product'){location.hash='#/adicionar/'+encodeURIComponent(el.dataset.id);return;}
 if(action==='clear-product-search'){state.productQuery='';render();return;}
 if(action==='share-product'){openShareDialog(findProduct(el.dataset.id));return;}
 if(action==='copy-product'){const p=findProduct(el.dataset.id);if(p&&!await copyText(productShareText(p)))openShareDialog(p);return;}
 if(action==='copy-message'){await copyText($('share-message')?.value||'');return;}
 if(action==='whatsapp-product'){window.open('https://wa.me/?text='+encodeURIComponent($('share-message')?.value||''),'_blank','noopener,noreferrer');return;}
 if(action==='native-share-product'){
  const p=findProduct(el.dataset.id),text=$('share-message')?.value||'';
  if(navigator.share){try{await navigator.share({title:p?.name||'Oferta',text});}catch(error){if(error.name!=='AbortError')toast('Use Copiar mensagem ou WhatsApp para compartilhar.',true);}}
  else await copyText(text);
  return;
 }
 if(action==='paste-link'){
  const form=el.closest('form');
  try{form.elements.affiliateUrl.value=await navigator.clipboard.readText();scheduleProductPreview(form,true);}catch{form.elements.affiliateUrl.focus();toast('Toque e segure no campo para colar, ou use Ctrl+V.');}
  return;
 }
 if(action==='pick-photo'){
  const form=el.closest('form');form.elements.image.value=el.dataset.url;form.elements.image.dataset.autofilled='0';delete form.dataset.photoFailed;
  form.querySelectorAll('[data-action="pick-photo"]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn===el)));renderPreviewCard(form);return;
 }
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
  }else await copyText(url);
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
 if(user&&receivedLink)location.hash='#/adicionar';
 await onRoute();
});
