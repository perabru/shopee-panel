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
 const originalUrl=String(input.originalUrl||'').trim();
 const affiliateUrl=String(input.affiliateUrl||'').trim();
 if(!validShopee(originalUrl))throw new Error('Informe uma URL válida da Shopee para o produto ou loja.');
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

function currentPath(){return location.hash.replace(/^#\/?/,'')||'';}
function parseRoute(){const parts=currentPath().split('/').filter(Boolean);return {route:parts[0]||'home',id:parts[1]||''};}
function shopUrl(uid){return new URL('./#/loja/'+encodeURIComponent(uid),location.href.split('#')[0]).href;}
function initials(name){return String(name||'VL').split(' ').map(s=>s[0]).filter(Boolean).slice(0,2).join('').toUpperCase();}
function categoryIcon(cat){return ({'Casa':'🏠','Eletrônicos':'⌁','Moda':'◈','Beleza':'✿','Esportes':'◎','Games':'▣','Acessórios':'✦','Lojas':'▦','Outros':'▧'})[cat]||'◉';}
function alertBox(type,text){return `<div class="alert ${type}">${text}</div>`;}
function loading(message='Carregando...'){return `<div class="loading-screen"><span class="loader"></span><p>${h(message)}</p></div>`;}
function empty(icon,title,subtitle,action=''){return `<div class="empty"><div class="empty-icon">${icon}</div><h3>${h(title)}</h3><p>${h(subtitle)}</p>${action}</div>`;}
function productPhoto(p){const src=safeImage(p.image);return `<div class="product-photo">${src?`<img src="${h(src)}" alt="${h(p.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'">`:`<div class="placeholder">${categoryIcon(p.category)}</div>`}</div>`;}
function productCard(p,admin=false){const link=validShopee(p.affiliateUrl)?p.affiliateUrl:'';const price=p.price!=null?`<div class="product-price">${money(p.price)}</div>`:`<div class="product-price muted">Consulte o preço na Shopee</div>`;return `<article class="product-card">${productPhoto(p)}<div class="product-card-body"><span class="pill orange" style="align-self:start;margin-bottom:9px">${h(p.category||'Outros')}</span><strong class="product-card-title">${h(p.name)}</strong><div class="product-card-meta">${h(p.description||'Oferta selecionada para esta vitrine.')}</div>${price}<div class="product-card-actions">${link?`<a href="${h(link)}" class="btn btn-orange btn-sm" target="_blank" rel="noopener noreferrer sponsored">Comprar na Shopee ↗</a>`:`<button class="btn btn-white btn-sm" disabled>Link indisponível</button>`}${admin?`<button class="btn btn-white btn-sm btn-icon" data-action="remove-product" data-id="${h(p.id)}" title="Excluir produto" aria-label="Excluir ${h(p.name)}">✕</button>`:''}</div><div class="product-note">Compra e pagamento finalizados na Shopee. Preço sujeito a alterações.</div></div></article>`;}
function offerCard(o,index){return `<article class="product-card">${productPhoto({...o,category:'Outros'})}<div class="product-card-body"><strong class="product-card-title">${h(o.name)}</strong><div class="product-card-meta">${h(o.shopName||'Loja Shopee')} ${o.rating?`· ★ ${h(o.rating.toFixed(1))}`:''}</div>${o.price!=null?`<div class="product-price">${money(o.price)}</div>`:'<div class="product-price muted">Preço na Shopee</div>'}<div style="margin-top:6px"><span class="pill green">Comissão anunciada: ${h((o.commissionRate*100).toFixed(1))}%</span></div><div class="product-card-actions"><button class="btn btn-orange btn-sm" data-action="publish-offer" data-index="${index}">+ Adicionar à minha vitrine</button></div><div class="product-note">Estimativa de comissão da oferta, não receita confirmada.</div></div></article>`;}
function renderTop(){const el=$('userActions');if(!state.authReady){el.innerHTML='<button class="btn btn-white btn-sm" disabled>Carregando...</button>';return;}if(!state.user){el.innerHTML='<button class="btn btn-orange" data-action="login"><span class="google-g" style="color:white;font-weight:800">G</span> Entrar com Google</button>';return;}const name=state.user.displayName||'Minha conta';el.innerHTML=`<div class="user-mini"><span class="avatar" title="${h(name)}">${h(initials(name))}</span><span class="username">${h(short(name.split(' ')[0]))}</span></div><a href="#/painel" class="btn btn-orange btn-sm">Meu painel</a>`;}
function home(){const shown=state.shops.filter(s=>(s.name+' '+s.description).toLowerCase().includes(state.homeQuery.toLowerCase()));return `<section class="hero"><div class="container"><div class="hero-panel"><div class="hero-content"><span class="eyebrow">✦ Sua loja, suas indicações</span><h1>Transforme suas indicações em uma <span class="brand-accent">vitrine de verdade.</span></h1><p>Crie sua loja pública, escolha produtos da Shopee, compartilhe seus links de afiliado e acompanhe suas comissões em um só lugar.</p><div class="hero-actions"><button class="btn btn-orange" data-action="start-store">Criar minha vitrine gratuita →</button><a href="#/como-funciona" class="btn btn-white">Como funciona</a></div></div><div class="hero-art" aria-hidden="true"><div class="dots-bg"></div><div class="hero-orbit"></div><div class="hero-orbit small"></div><div class="hero-illustration"><span>✓</span></div><div class="floating-card">✦ Sua vitrine online</div><div class="floating-card second">Compras na Shopee ↗</div></div></div></div></section><section class="section"><div class="container"><div class="section-heading"><div><span class="eyebrow">Descubra</span><h2>Vitrines para explorar</h2><p>Seleções de afiliados reais que você pode visitar sem precisar de conta.</p></div><span class="pill gray">${state.shops.length} ${state.shops.length===1?'vitrine pública':'vitrines públicas'}</span></div><form class="searchbar" data-form="search-home" style="margin-bottom:22px"><span class="searchbar-icon">⌕</span><input name="search" placeholder="Pesquisar uma vitrine ou uma categoria..." value="${h(state.homeQuery)}" aria-label="Buscar vitrines"><button class="btn btn-orange btn-sm">Buscar</button></form>${state.publicError?alertBox('warning',h(state.publicError)):''}${shown.length?`<div class="shop-grid">${shown.map(s=>`<a class="shop-card" href="#/loja/${encodeURIComponent(s.ownerUid)}"><div class="shop-card-top"><div class="store-logo">${h(initials(s.name))}</div><div><span class="pill orange">Vitrine pública</span><h3 style="margin-top:6px">${h(s.name)}</h3></div></div><p>${h(s.description||'Produtos selecionados por um afiliado.')}</p><div class="shop-card-bottom"><span>${Number(s.productCount)||0} produtos</span><span class="text-link">Visitar vitrine →</span></div></a>`).join('')}</div>`:empty('▦',state.homeQuery?'Nenhuma vitrine encontrada':'As primeiras vitrines aparecerão aqui',state.homeQuery?'Tente pesquisar por outro termo.':'Entre com Google e crie a primeira vitrine pública da plataforma.',`<button class="btn btn-orange" data-action="start-store">Criar minha vitrine →</button>`)}</div></section><section class="section"><div class="container"><div class="section-heading"><div><span class="eyebrow">Simples para quem vende e quem compra</span><h2>Tudo no mesmo lugar</h2></div></div><div class="feature-grid"><article class="feature-card"><div class="feature-icon">⌕</div><h3>Busque produtos</h3><p>Use a API de afiliados da Shopee para encontrar ofertas e importar produtos com imagens, preços e links.</p></article><article class="feature-card"><div class="feature-icon">▤</div><h3>Tenha sua loja pública</h3><p>Compartilhe um endereço exclusivo. Qualquer pessoa pode ver seus produtos e comprar diretamente na Shopee.</p></article><article class="feature-card"><div class="feature-icon">◴</div><h3>Veja suas comissões</h3><p>Conecte sua conta de afiliado e consulte as conversões reportadas pela Shopee, sem valores fictícios.</p></article></div></div></section>`;}
function how(){return `<section class="section"><div class="container" style="padding-top:36px"><div class="page-header"><div><span class="eyebrow">Sua vitrine em poucos passos</span><h1>Como funciona</h1><p>Compras e pagamentos são feitos diretamente na Shopee.</p></div></div><div class="feature-grid"><div class="feature-card"><div class="feature-icon">1</div><h3>Entre com Google</h3><p>Seu perfil Google cria um cadastro nesta plataforma. Isso não dá acesso automático à sua conta Shopee.</p></div><div class="feature-card"><div class="feature-icon">2</div><h3>Conecte seu programa de afiliados</h3><p>Informe App ID e Secret da API de afiliados em área protegida. Também é possível colar links próprios já convertidos na Shopee.</p></div><div class="feature-card"><div class="feature-icon">3</div><h3>Pesquise, publique e divulgue</h3><p>Busque ofertas da Shopee, gere links e tenha uma loja pública para visitantes acessarem e comprarem no site oficial.</p></div></div><div class="panel" style="margin-top:22px"><h3 style="margin-bottom:8px">Sobre o exemplo enviado</h3><p>Você pode usar <a class="text-link" href="https://shopee.com.br/q63ifc2_ce" target="_blank" rel="noopener noreferrer">esta loja Shopee de referência ↗</a> como inspiração visual ou publicar um link para ela. O sistema não afirma que essa loja pertence a você e não copia automaticamente seus produtos.</p></div><button class="btn btn-orange" data-action="start-store">Começar minha vitrine →</button></div></section>`;}
function store(){const s=state.publicShop;if(state.loadingStore)return loading('Abrindo vitrine pública...');if(!s)return `<div class="container section">${empty('▢','Vitrine não encontrada','Esta loja não existe ou não está pública.',`<a href="#/" class="btn btn-orange">Voltar às vitrines</a>`)}</div>`;
 const own=state.user?.uid===s.ownerUid;
 const products=state.publicProducts.filter(p=>((state.category==='Tudo')||(p.category===state.category))&&(p.name+' '+(p.description||'')).toLowerCase().includes(state.storeQuery.toLowerCase()));
 return `<div class="container"><div class="shop-header"><div style="position:relative;z-index:1"><span class="eyebrow white">✦ Vitrine pública de afiliado</span><h1>${h(s.name)}</h1><p>${h(s.description||'Seleção de produtos com links de afiliado da Shopee.')}</p><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:17px"><span class="pill orange">${state.publicProducts.length} produtos</span>${s.referenceUrl&&validShopee(s.referenceUrl)?`<a class="btn btn-white btn-sm" target="_blank" rel="noopener noreferrer" href="${h(s.referenceUrl)}">Loja Shopee de referência ↗</a>`:''}</div></div><div class="shop-logo">${h(initials(s.name))}</div></div><div class="shop-controls"><div><h2>Produtos selecionados</h2><p class="result-count" style="margin-top:5px">${products.length} itens nesta seleção</p></div><div style="display:flex;gap:9px;flex-wrap:wrap"><button class="btn btn-white btn-sm" data-action="copy" data-url="${h(shopUrl(s.ownerUid))}">♧ Compartilhar loja</button>${own?'<a href="#/catalogo" class="btn btn-orange btn-sm">+ Adicionar produto</a>':''}</div></div><form class="searchbar" data-form="search-store" style="margin-bottom:20px"><span class="searchbar-icon">⌕</span><input name="search" value="${h(state.storeQuery)}" placeholder="O que você está procurando?" aria-label="Pesquisar produtos da loja"><button class="btn btn-orange btn-sm">Buscar</button></form><div class="chips" style="margin-bottom:23px">${categories.map(c=>`<button class="chip ${state.category===c?'active':''}" data-action="category" data-category="${h(c)}">${h(c)}</button>`).join('')}</div>${products.length?`<div class="product-grid">${products.map(p=>productCard(p,own)).join('')}</div>`:empty('▧',state.publicProducts.length?'Nenhum produto neste filtro':'Esta vitrine ainda não tem produtos',state.publicProducts.length?'Experimente uma categoria diferente.':'O proprietário ainda está escolhendo ofertas para publicar.',own?`<a href="#/adicionar" class="btn btn-orange">Adicionar um produto</a>`:'')}<div class="alert info" style="margin-top:24px">Você será direcionado ao site ou aplicativo da Shopee para concluir a compra. Esta é uma vitrine independente e pode conter links de afiliado.</div></div>`;}
function sidebar(){const items=[['painel','▦','Visão geral'],['catalogo','⌕','Buscar na Shopee'],['adicionar','＋','Adicionar por link'],['produtos','▤','Meus produtos'],['financeiro','◴','Comissões'],['configuracoes','⚙','Configurações']];const u=state.user;return `<aside class="sidebar"><div class="side-profile"><span class="avatar">${h(initials(u?.displayName))}</span><div style="min-width:0"><strong>${h(u?.displayName||'Minha conta')}</strong><small>Minha vitrine de afiliados</small></div></div><nav class="side-nav">${items.map(([id,icon,label])=>`<a href="#/${id}" class="${state.route===id?'active':''}"><span class="side-icon">${icon}</span>${h(label)}</a>`).join('')}</nav><div class="sidebar-bottom">Vitrine Livre · Administração privada</div></aside>`;}
function adminPage(body){return `<div class="container layout">${sidebar()}<div class="dashboard-main">${state.ownerError?alertBox('danger',`<strong>Configuração do Realtime Database pendente.</strong> ${h(state.ownerError)} <a href="https://console.firebase.google.com/project/gahepatama-4707c/database" target="_blank" rel="noopener noreferrer">Abrir Firebase ↗</a>`):''}${body}</div></div>`;}
function adminHead(title,desc,actions=''){return `<div class="page-header"><div><span class="eyebrow">Área do afiliado</span><h1>${h(title)}</h1><p>${h(desc)}</p></div><div class="page-header-actions">${actions}</div></div>`;}
function metric(label,value,icon,detail){return `<div class="metric"><div class="metric-icon">${icon}</div><div class="metric-label">${h(label)}</div><div class="metric-value">${value}</div><div class="metric-detail">${h(detail)}</div></div>`;}
function adminHome(){const s=state.shop;const r=state.report?.summary;const base=adminHead('Visão geral','Sua vitrine, seus produtos e resultados em um lugar.',`${s?`<a href="#/loja/${encodeURIComponent(s.ownerUid)}" class="btn btn-white btn-sm">↗ Ver minha loja pública</a>`:''}<a href="#/catalogo" class="btn btn-orange btn-sm">+ Adicionar ofertas</a>`);
 const stats=`<div class="metric-grid">${metric('Produtos publicados',state.myProducts.length,'▤','Na sua vitrine')}${metric('Comissão estimada',r?money(r.total):'—','R$','Últimos '+(state.report?.days||30)+' dias · quando consultada')}${metric('Pedidos reportados',r?String(r.orders):'—','▦','Dados da API Shopee')}${metric('Comissão da vitrine',r?money(r.siteTotal):'—','◴','Identificada pela marcação SubId')}</div>`;
 return adminPage(base+stats+`<div class="row-grid"><section class="panel"><div class="panel-title"><h3>Seu caminho para vender</h3><span class="pill green">Simples e direto</span></div><div class="steps"><div class="step"><div class="step-count">1</div><div><strong>Conecte seu programa de afiliados</strong><p>Você já está autenticado pelo Google. Para automatizar links e relatórios, conecte App ID + Secret da Shopee.</p><a href="#/configuracoes" class="text-link" style="font-size:12px">${state.connected?'Conexão configurada ✓':'Conectar agora →'}</a></div></div><div class="step"><div class="step-count">2</div><div><strong>Encontre ofertas e publique</strong><p>Pesquise produtos pela API ou cole um link de afiliado já gerado na Shopee.</p><a href="#/catalogo" class="text-link" style="font-size:12px">Explorar produtos →</a></div></div><div class="step"><div class="step-count">3</div><div><strong>Compartilhe a vitrine pública</strong><p>Seus visitantes verão os produtos e serão direcionados para a Shopee na compra.</p></div></div></div>${s?`<div class="sharing"><label>SEU LINK PÚBLICO</label><div class="share-line"><input readonly aria-label="Endereço da vitrine" value="${h(shopUrl(s.ownerUid))}"><button class="btn btn-orange btn-sm" data-action="copy" data-url="${h(shopUrl(s.ownerUid))}">Copiar</button></div></div>`:''}</section><section class="panel"><div class="panel-title"><h3>Conexão com a Shopee</h3><span class="pill ${state.connected?'green':'orange'}">${state.connected?'Conectada':'Pendente'}</span></div><p>O login Google identifica você nesta plataforma. A conta de afiliados precisa ser vinculada separadamente para gerar seus links personalizados.</p><div class="status-row"><span class="dot ${state.connected?'green':''}"></span><strong>${state.connected?'API de afiliados vinculada':'API não vinculada'}</strong></div><div class="form-actions"><a href="#/configuracoes" class="btn btn-${state.connected?'white':'orange'}">${state.connected?'Gerenciar conexão':'Conectar Shopee →'}</a></div><div class="form-divider"></div><h3 style="margin-bottom:8px">Resultados da Shopee</h3><p>${r?'Último relatório consultado: '+formattedDate(state.report.consultedAt):'Nenhum relatório foi consultado nesta sessão.'}</p><div class="form-actions"><button class="btn btn-white" data-action="load-report" data-days="30">Atualizar comissões</button><a href="#/financeiro" class="text-link">Detalhes →</a></div></section></div>${state.myProducts.length?`<div class="section-heading" style="margin-top:15px"><div><h2>Produtos mais recentes</h2><p>Seus últimos produtos adicionados.</p></div><a href="#/produtos" class="text-link">Ver todos →</a></div><div class="product-grid">${state.myProducts.slice(0,4).map(p=>productCard(p,true)).join('')}</div>`:''}`);
}
function catalog(){return adminPage(adminHead('Buscar produtos','Pesquise diretamente na Shopee ou pela sua API de afiliados, quando conectada.','<a href="#/adicionar" class="btn btn-white btn-sm">Tenho um link da Shopee →</a>')+(!state.connected?alertBox('warning','<strong>Busca disponível.</strong> Pesquise diretamente na Shopee e adicione o link que você converteu no programa de afiliados. Para resultados integrados e geração automática, conecte a API em <a href="#/configuracoes">Configurações</a>.'):alertBox('info','Os produtos vêm da API de afiliados. Ao adicionar, o sistema gera um link associado às suas credenciais e publica em sua vitrine.'))+`<div class="panel"><div class="panel-title"><h3>Pesquisar catálogo Shopee</h3><span class="pill orange">${state.connected?'API de afiliados':'Busca externa Shopee'}</span></div><form class="search-tool" data-form="search-offers"><div class="searchbar"><span class="searchbar-icon">⌕</span><input name="keyword" value="${h(state.offerQuery)}" placeholder="Ex.: fone bluetooth, air fryer, camiseta..." aria-label="Busca de ofertas Shopee" required minlength="2"><button class="btn btn-orange btn-sm">${state.connected?'Buscar ofertas':'Buscar na Shopee ↗'}</button></div></form>${state.loadingOffers?loading('Buscando ofertas da Shopee...'):(state.offers.length?`<div style="margin-bottom:14px" class="result-count">${state.offers.length} ofertas encontradas ${state.offerPage>1?'· página '+state.offerPage:''}</div><div class="product-grid">${state.offers.map(offerCard).join('')}</div>${state.offerNext?`<div style="text-align:center;margin-top:18px"><button data-action="more-offers" class="btn btn-white">Carregar mais ofertas</button></div>`:''}`:empty('⌕','Encontre produtos para sua vitrine',state.connected?'Digite o nome de um produto e clique em Buscar ofertas.':'Pesquise na Shopee sem integração e publique links já convertidos no programa de afiliados.',`<a href="#/adicionar" class="btn btn-white">Adicionar pelo link →</a>`))}</div>`);}
function addManual(){return adminPage(adminHead('Adicionar por link','Publique um produto ou uma loja da Shopee em sua vitrine.')+alertBox(state.connected?'info':'warning',state.connected?'Sua API está conectada: ao salvar, o sistema vai gerar automaticamente o link de afiliado para o endereço Shopee informado.':'Sem conexão com a API, você precisa colar um link de afiliado que já tenha gerado no portal da Shopee. O sistema não consegue verificar se o link informado pertence a você.')+`<div class="panel"><div class="panel-title"><h3>Informações do anúncio</h3><span class="pill gray">Exibição pública</span></div><form data-form="manual-product"><div class="form-grid"><label class="form-control span-2"><span class="form-label">Nome do produto ou loja *</span><input name="name" class="field" required maxlength="180" placeholder="Ex.: Fone Bluetooth ou Minha loja favorita"></label><label class="form-control span-2"><span class="form-label">Link do produto ou loja na Shopee *</span><input name="originalUrl" class="field" required type="url" placeholder="https://shopee.com.br/..." autocomplete="off"><span class="hint">Use o endereço real do produto ou da loja, inclusive links curtos oficiais.</span></label><label class="form-control span-2"><span class="form-label">Meu link de afiliado Shopee já convertido ${state.connected?'(opcional)':'*'}</span><input name="affiliateUrl" class="field" type="url" ${state.connected?'':'required'} placeholder="https://s.shopee.com.br/..." autocomplete="off"><span class="hint">Com link preenchido, a publicação é direta pelo Realtime Database. Sem link, só é possível gerar pela API Shopee conectada.</span></label><label class="form-control"><span class="form-label">Preço exibido (opcional)</span><input name="price" type="number" min="0" step="0.01" class="field" placeholder="Ex.: 49.90"><span class="hint">Os preços podem variar na Shopee.</span></label><label class="form-control"><span class="form-label">Categoria</span><select name="category" class="field">${categories.slice(1).map(x=>`<option value="${h(x)}">${h(x)}</option>`).join('')}</select></label><label class="form-control span-2"><span class="form-label">URL de imagem (opcional)</span><input type="url" name="image" class="field" placeholder="https://..." autocomplete="off"><span class="hint">Cole uma imagem HTTPS que você tenha direito de divulgar; não é necessário preencher.</span></label><label class="form-control span-2"><span class="form-label">Descrição curta</span><textarea name="description" class="field field-area" maxlength="350" placeholder="O que torna este produto interessante?"></textarea></label></div><div class="form-actions"><button class="btn btn-orange" type="submit">Publicar na minha vitrine →</button><a class="btn btn-white" href="#/catalogo">Voltar</a></div></form></div><div class="panel"><h3 style="margin-bottom:9px">Exemplo de link de loja</h3><p>Você pode divulgar lojas inteiras. Este é apenas o exemplo que informou, não uma loja já associada à sua conta: <a class="text-link" target="_blank" rel="noopener noreferrer" href="https://shopee.com.br/q63ifc2_ce">shopee.com.br/q63ifc2_ce ↗</a>.</p></div>`);}
function adminProducts(){return adminPage(adminHead('Meus produtos','Gerencie os itens publicados na sua vitrine.',`<a href="#/adicionar" class="btn btn-orange btn-sm">+ Novo produto</a>`)+(state.myProducts.length?`<div class="panel"><div class="panel-title"><h3>Produtos publicados</h3><span class="pill gray">${state.myProducts.length} itens</span></div><div class="table-scroll"><table class="table"><thead><tr><th>Produto</th><th>Preço</th><th>Link</th><th>Origem</th><th>Ações</th></tr></thead><tbody>${state.myProducts.map(p=>`<tr><td><div class="table-product">${safeImage(p.image)?`<img class="table-product-thumb" src="${h(safeImage(p.image))}" alt="">`:'<div class="table-product-thumb" style="display:grid;place-items:center">▧</div>'}<div><strong>${h(p.name)}</strong><small>${h(p.category)}</small></div></div></td><td>${p.price==null?'—':money(p.price)}</td><td><span class="pill ${p.trackingSource==='api'?'green':'gray'}">${p.trackingSource==='api'?'Link da API':'Link informado'}</span></td><td>Shopee</td><td><div class="table-actions"><a class="btn btn-white btn-sm" href="${h(validShopee(p.affiliateUrl)?p.affiliateUrl:'https://shopee.com.br')}" rel="noopener noreferrer sponsored" target="_blank">Abrir ↗</a><button class="btn btn-outline btn-sm" data-action="remove-product" data-id="${h(p.id)}">Excluir</button></div></td></tr>`).join('')}</tbody></table></div></div>`:empty('▤','Sua vitrine está esperando produtos','Busque produtos da Shopee ou adicione seu próprio link de afiliado.',`<a href="#/catalogo" class="btn btn-orange">Buscar produtos →</a>`)));}
function finance(){const r=state.report?.summary;const days=state.report?.days||30;return adminPage(adminHead('Minhas comissões','Acompanhe os resultados disponíveis na sua API de Afiliados Shopee.',`<button class="btn btn-orange btn-sm" data-action="load-report" data-days="30">↻ Consultar Shopee</button>`)+alertBox('info','Os números abaixo são <strong>conversões e comissões reportadas pela API</strong>. Não representam dinheiro disponível para saque; valores estimados podem mudar até a validação e não incluem necessariamente todos os períodos.')+(!state.connected?alertBox('warning','Conecte sua API de afiliados em <a href="#/configuracoes">Configurações</a> para consultar valores reais.'):state.reportError?alertBox('danger',h(state.reportError)):'')+`<div class="report-band"><span class="eyebrow white">COMISSÃO ESTIMADA · ÚLTIMOS ${days} DIAS</span><strong>${r?money(r.total):'—'}</strong><p>${r?'Valor informado pelo relatório de conversões da Shopee.':'Clique em Consultar Shopee para carregar os valores da sua conta.'}</p>${r?`<div class="report-bars"><span style="width:${Math.min(100,r.total>0?r.completed/r.total*100:0)}%"></span><span style="width:${Math.min(100,r.total>0?r.pending/r.total*100:0)}%"></span></div><small>Concluídos e pendentes classificados por status de pedidos; alguns pedidos podem misturar status.</small>`:''}</div><div class="metric-grid">${metric('Estimadas na vitrine',r?money(r.siteTotal):'—','◎','Com identificação SubId shopeepanel')}${metric('Pedidos informados',r?String(r.orders):'—','▤','Janela do relatório')}${metric('Comissões concluídas',r?money(r.completed):'—','✓','Ainda sujeitas à validação')}${metric('Conversões únicas',r?String(r.conversions):'—','◴','Registros encontrados na API')}</div><div class="panel"><div class="panel-title"><h3>Sobre os números</h3><span class="pill orange">Transparência</span></div><p>O total da conta inclui as conversões reportadas pela Shopee nos últimos ${days} dias. A comissão atribuída a esta vitrine considera a marcação SubId dos links gerados aqui. Links adicionados manualmente podem não ser identificados como vendas desta vitrine.</p><div class="form-actions"><button class="btn btn-white" data-action="load-report" data-days="7">Últimos 7 dias</button><button class="btn btn-white" data-action="load-report" data-days="30">Últimos 30 dias</button></div>${r?`<div class="status-row">${r.partial?'⚠ O relatório pode estar incompleto por limite de paginação.':'✓ Relatório consultado em '+formattedDate(state.report.consultedAt)}</div>`:''}</div>`);}
function settings(){const s=state.shop||{};return adminPage(adminHead('Configurações','Personalize a vitrine e vincule a API de afiliados da Shopee.')+`<div class="panel"><div class="panel-title"><h3>Minha vitrine pública</h3><span class="pill green">Compartilhável</span></div><form data-form="store-settings"><div class="form-grid"><label class="form-control span-2"><span class="form-label">Nome da vitrine *</span><input class="field" name="name" required maxlength="70" value="${h(s.name||'Minha vitrine')}"></label><label class="form-control span-2"><span class="form-label">Descrição</span><textarea class="field field-area" maxlength="240" name="description">${h(s.description||'')}</textarea></label><label class="form-control span-2"><span class="form-label">Loja Shopee de referência (opcional)</span><input class="field" name="referenceUrl" type="url" value="${h(s.referenceUrl||'')}" placeholder="Exemplo: https://shopee.com.br/q63ifc2_ce"><span class="hint">Apenas uma referência externa, sem importar produtos ou comprovar titularidade.</span></label></div><label style="display:flex;align-items:center;gap:10px;margin:19px 0;font-size:13px"><input type="checkbox" name="isPublic" ${s.isPublic!==false?'checked':''}> Deixar minha vitrine visível para qualquer visitante</label><div class="form-actions"><button class="btn btn-orange" type="submit">Salvar vitrine</button></div></form></div><div class="panel"><div class="panel-title"><h3>Conectar programa de afiliados Shopee</h3><span class="pill ${state.connected?'green':'orange'}">${state.connected?'Conectado':'Não conectado'}</span></div>${state.connected?`<div class="connected"><span style="font-size:24px">✓</span><div><strong>API de Afiliados conectada</strong><p>Você pode buscar ofertas, gerar links e consultar conversões. O Secret fica criptografado no backend, não no site público.</p></div></div><div class="form-actions"><button class="btn btn-outline" data-action="disconnect">Desconectar API Shopee</button></div>`:`<p>O login Google serve para esta plataforma. Para gerar links de afiliado com sua própria atribuição, conecte App ID e Secret da <strong>Open API de Afiliados Shopee</strong>. Não digite sua senha de login Shopee.</p><div class="form-divider"></div><form data-form="affiliate-connect"><div class="form-grid"><label class="form-control span-2"><span class="form-label">App ID da Open API</span><input name="appId" class="field" required minlength="3" maxlength="100" autocomplete="off" placeholder="Informe seu App ID"></label><label class="form-control span-2"><span class="form-label">Secret da Open API</span><input name="secret" type="password" required minlength="6" maxlength="300" class="field" autocomplete="new-password" placeholder="Secret da API (não é sua senha Shopee)"><span class="hint">As credenciais serão verificadas na API Shopee e armazenadas criptografadas no Realtime Database por uma Cloud Function segura (requer implantação separada).</span></label></div><div class="form-actions"><button type="submit" class="btn btn-orange">Vincular API de afiliados</button><a href="https://affiliate.shopee.com.br/open_api" target="_blank" rel="noopener noreferrer" class="text-link">Abrir portal Shopee ↗</a></div></form>`}</div><div class="panel"><h3 style="margin-bottom:8px">Acesso e privacidade</h3><p>Seu Gmail identifica o proprietário, mas não libera automaticamente a conta Shopee. A vitrine funciona com links manuais sem Cloud Functions. Dados de comissões e credenciais não ficam disponíveis aos visitantes. Você pode remover sua vinculação da API a qualquer momento.</p>${s.ownerUid?`<div class="sharing"><label>ENDEREÇO PÚBLICO</label><div class="share-line"><input readonly value="${h(shopUrl(s.ownerUid))}" aria-label="Endereço público"><button class="btn btn-orange btn-sm" data-action="copy" data-url="${h(shopUrl(s.ownerUid))}">Copiar</button></div></div>`:''}<div class="form-actions"><button class="btn btn-white" data-action="logout">Sair da conta Google</button></div></div>`);}
function authNeeded(){return `<div class="container"><div class="auth-card"><div class="empty-icon">◈</div><span class="eyebrow">Acesso do afiliado</span><h2>Entre para criar sua vitrine</h2><p>Use sua conta Google para gerenciar produtos, criar links de afiliado e consultar suas comissões de forma privada.</p><button class="btn btn-google" data-action="login"><span class="google-g">G</span> Continuar com Google</button><div class="alert info" style="margin-top:20px;text-align:left;font-size:12px">Entrar com Google não conecta automaticamente sua conta Shopee. Você poderá vincular a API de afiliados depois.</div></div></div>`;}
function render(){renderTop();const restricted=['painel','catalogo','adicionar','produtos','financeiro','configuracoes'];if(!state.authReady){app.innerHTML=loading('Preparando sua vitrine...');return;}if(restricted.includes(state.route)&&!state.user){app.innerHTML=authNeeded();return;}if(state.route==='loja'){app.innerHTML=store();return;}if(state.route==='como-funciona'){app.innerHTML=how();return;}if(restricted.includes(state.route)&&state.loading){app.innerHTML=loading('Carregando painel...');return;}switch(state.route){case 'painel':app.innerHTML=adminHome();break;case 'catalogo':app.innerHTML=catalog();break;case 'adicionar':app.innerHTML=addManual();break;case 'produtos':app.innerHTML=adminProducts();break;case 'financeiro':app.innerHTML=finance();break;case 'configuracoes':app.innerHTML=settings();break;default:app.innerHTML=home();}}
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

async function onRoute(){const {route,id}=parseRoute();state.route=route;state.routeId=id;state.storeQuery='';state.category='Tudo';if(!state.authReady){render();return;}if(route==='loja'){await fetchStore(id);return;}render();if(route==='home'&&!state.shops.length)await fetchPublicShops();}
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
 if(type==='search-offers'){
  const keyword=String(values.keyword||'').trim();if(keyword.length<2){toast('Digite pelo menos duas letras para pesquisar.',true);return;}
  await loadOffers(keyword,1);return;
 }
 formBusy(form,true);
 try{
  if(type==='manual-product'){
   if(state.connected&&!String(values.affiliateUrl||'').trim()){
    const r=await call('publishProduct',values);
    toast(r.trackingSource==='api'?'Link de afiliado gerado e produto publicado!':'Produto publicado.');
   }else{
    await saveManualProduct(values);
    toast('Produto publicado com o link de afiliado que você informou.');
   }
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

document.addEventListener('click',async(event)=>{
 const el=event.target.closest('[data-action]');if(!el)return;
 const action=el.dataset.action;
 if(action==='login'||action==='start-store'){if(!state.user){await logIn();}else location.hash='#/painel';return;}
 if(action==='logout'){await signOut(auth);location.hash='#/';toast('Você saiu da sua conta.');return;}
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