import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-functions.js';

// Public Firebase browser configuration supplied by the project owner.
// Seller tokens / partner keys must NEVER go in this file or localStorage.
const firebaseConfig = {
  apiKey: 'AIzaSyA1dsuvCYdG3dwGKESqRGk5BYn5kEbHN7c',
  authDomain: 'gahepatama-4707c.firebaseapp.com',
  databaseURL: 'https://gahepatama-4707c-default-rtdb.firebaseio.com',
  projectId: 'gahepatama-4707c',
  storageBucket: 'gahepatama-4707c.firebasestorage.app',
  messagingSenderId: '330984382062',
  appId: '1:330984382062:web:3000a47a3ce6ef62d8907f'
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const functions = getFunctions(app, 'southamerica-east1');
const googleProvider = new GoogleAuthProvider();

const ICONS = {
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  box:'<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="M3 7v10l9 5 9-5V7M12 12v10"/>',
  'plus-circle':'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  bag:'<path d="M5 9h14l1 12H4L5 9ZM9 10V7a3 3 0 0 1 6 0v3"/>',
  wallet:'<rect x="2" y="5" width="20" height="15" rx="3"/><path d="M2 9h20M16 15h2"/>',
  link:'<path d="M10 13a5 5 0 0 0 7.1 0l3-3A5 5 0 0 0 13 3l-2 2M14 11a5 5 0 0 0-7.1 0l-3 3A5 5 0 0 0 11 21l2-2"/>',
  settings:'<path d="M12 3 14 4l2-.5 1.5 2 .1 1.8 1.9 1 2 1-.4 2.5.4 2.3-2 1-1.9 1-.1 1.8-1.5 2L14 20l-2 1-2-1-2 .5-1.5-2-.1-1.8-1.9-1-2-1 .4-2.5-.4-2.3 2-1 1.9-1 .1-1.8 1.5-2L10 4l2-1Z"/><circle cx="12" cy="12" r="3"/>',
  store:'<path d="M3 10V6h18v4l-2 3a3 3 0 0 1-4 0 3 3 0 0 1-6 0 3 3 0 0 1-4 0l-2-3ZM5 13v8h14v-8M9 21v-6h6v6"/>',
  'chevron-down':'<path d="m6 9 6 6 6-6"/>',
  refresh:'<path d="M20 11a8 8 0 0 0-14-5L4 8m0-5v5h5M4 13a8 8 0 0 0 14 5l2-2m0 5v-5h-5"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7h.01"/>',
  download:'<path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  chart:'<path d="M3 21h18M5 17V9m5 8V4m5 13v-6m5 6V7"/>',
  'arrow-right':'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  sparkle:'<path d="m12 2 1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"/>',
  shield:'<path d="M12 2 20 6v6c0 5-3.3 8.1-8 10-4.7-1.9-8-5-8-10V6l8-4ZM9 12l2 2 4-4"/>',
  upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 5-5 3 3 4-5 6 7"/>',
  save:'<path d="M5 3h12l4 4v14H3V3h2ZM7 3v7h10V3M7 21v-8h10v8"/>',
  send:'<path d="m22 2-7 20-4-9-9-4 20-7ZM11 13 22 2"/>',
  external:'<path d="M14 4h6v6M10 14 20 4M20 14v6H4V4h6"/>',
  check:'<path d="m4 12 5 5L20 6"/>',
  alert:'<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 17h.01"/>',
  logout:'<path d="M10 4H4v16h6M13 8l4 4-4 4m4-4H8"/>'
};
const svg = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.info}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el => {el.innerHTML = svg(el.dataset.icon);});

const el = id => document.getElementById(id);
const safe = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = value => {try {let u=new URL(String(value));return u.protocol==='https:'?u.href:'';}catch{return ''}};
const money = amount => Number.isFinite(Number(amount)) ? new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(amount)) : '—';
const dateBR = ts => ts ? new Date(typeof ts==='number'?ts*1000:ts).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}) : '—';
const dayKey = ts => {let d=new Date(Number(ts)*1000);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const idNum = n => /^\d+$/.test(String(n)) ? String(n) : '';
const labels = {painel:'Visão geral',produtos:'Meus produtos',publicar:'Publicar produto',pedidos:'Pedidos',financeiro:'Financeiro',integracoes:'Integrações',ajustes:'Configurações'};
const demoProducts = [
  {item_id:1001,item_name:'Organizador modular para armários • kit 6 peças',price:69.90,stock:32,item_status:'NORMAL',image_url:''},
  {item_id:1002,item_name:'Suporte articulado para notebook com ajuste',price:89.90,stock:18,item_status:'NORMAL',image_url:''},
  {item_id:1003,item_name:'Luminária LED de mesa recarregável',price:54.90,stock:46,item_status:'NORMAL',image_url:''},
  {item_id:1004,item_name:'Bolsa organizadora multiuso para viagem',price:39.90,stock:0,item_status:'UNLIST',image_url:''}
];
const demoOrders = Array.from({length:17},(_,i)=>({order_sn:`EXEMPLO${String(2300+i).padStart(7,'0')}`,order_status:i%6===0?'COMPLETED':i%3===0?'READY_TO_SHIP':'SHIPPED',create_time:Math.floor((Date.now()-i*0.77*86400000)/1000),total_amount:[159.8,89.9,54.9,69.9,39.9][i%5],item_name:demoProducts[i%4].item_name}));
const demoFinance = {pending_amount:1248.70,released_amount:3961.23,records:[]};
const state = {user:null,demo:true,shops:[],shopId:'',orders:[],products:[],finance:null,financeError:'',drafts:[],uploadFiles:[],pagesLoaded:new Set(),busy:false,chartPoints:[],lastSynced:null,liveDataLoaded:false};
let authSignup=false;let resolverConfirm=null;let fetchingPromise=null;

function toast(message,kind='info'){
  const div=document.createElement('div');div.className=`toast ${kind==='success'?'good':kind==='error'?'bad':''}`;
  div.innerHTML=`${svg(kind==='error'?'alert':kind==='success'?'check':'info')}<span>${safe(message)}</span><button aria-label="Fechar">×</button>`;
  div.querySelector('button').onclick=()=>div.remove();el('toastZone').appendChild(div);setTimeout(()=>div.remove(),6500);
}
function formatError(e){
  const c=String(e?.code||''); if(c.includes('popup-closed-by-user'))return 'Login cancelado.';
  if(c.includes('unauthorized-domain'))return 'Inclua este domínio em Firebase Auth → Domínios autorizados.';
  if(c.includes('invalid-credential')||c.includes('wrong-password'))return 'E-mail ou senha inválidos.';
  if(c.includes('email-already-in-use'))return 'E-mail já registrado. Use a opção Entrar.';
  if(c.includes('weak-password'))return 'Use uma senha com pelo menos seis caracteres.';
  if(c.includes('permission-denied'))return 'Sua conta não possui autorização para esta operação.';
  if(c.includes('not-found')||c.includes('internal')||c.includes('unavailable'))return 'O backend do Firebase pode não estar implantado ou está indisponível. Veja o guia de configuração.';
  return String(e?.message||'Ocorreu um problema').replace(/^Firebase: /,'').slice(0,250);
}
async function invoke(name,data={}){if(!state.user)throw Error('Entre na conta antes de continuar.');const fn=httpsCallable(functions,name,{timeout:90000});const response=await fn(data);return response.data;}
function setBusy(v){state.busy=v;document.querySelectorAll('#syncTop,#reloadOrders,#reloadProducts,#reloadFinance,#settingsSync').forEach(x=>x.disabled=v);}
function setupTheme(){const theme=localStorage.getItem('shopeeStudioTheme')||'light';document.documentElement.dataset.theme=theme;el('darkMode').checked=theme==='dark';}
setupTheme();
el('darkMode').addEventListener('change',e=>{const next=e.target.checked?'dark':'light';document.documentElement.dataset.theme=next;localStorage.setItem('shopeeStudioTheme',next);drawChart();});
function setDemo(next,{quiet=false}={}){
  if(!next&&!state.user){openAuth();el('demoMode').checked=true;return;}
  state.demo=next;el('demoMode').checked=next;state.liveDataLoaded=false;
  if(next){state.products=demoProducts;state.orders=demoOrders;state.finance=demoFinance;state.financeError='';state.shopId='';state.lastSynced=null;state.drafts=JSON.parse(localStorage.getItem('shopeeStudioDemoDrafts')||'[]');}
  else{state.orders=[];state.products=[];state.finance=null;state.financeError='';state.shopId=state.shops[0]?.shopId||'';state.drafts=[];}
  updateModeUI();renderAll();if(!next)loadLive(true);else if(!quiet)toast('Modo demonstração: dados ilustrativos, sem vínculo com a Shopee.');
}
el('demoMode').addEventListener('change',e=>setDemo(e.target.checked));
function updateModeUI(){
  const badge=el('modeBadge');badge.className='mode-badge '+(state.demo?'demo':state.shopId?'live':'offline');badge.innerHTML=`<span class="status-dot"></span>${state.demo?'Modo demonstração':state.shopId?'Loja conectada':'Aguardando loja'}`;
  el('demoNote').hidden=!state.demo;el('shopSelect').disabled=state.demo;
  el('accountButton').textContent=state.user?(state.user.displayName||state.user.email||'?')[0].toUpperCase():'?';
  el('settingsAvatar').textContent=state.user?(state.user.displayName||state.user.email||'?')[0].toUpperCase():'?';
  el('settingsName').textContent=state.user?.displayName||state.user?.email?.split('@')[0]||'Visitante';el('settingsEmail').textContent=state.user?.email||'Faça login para gerenciar sua loja';
  el('settingsLogout').hidden=!state.user;
  const chooser=el('shopSelect');let html=state.demo?'<option value="">Loja de demonstração</option>':state.shops.length?state.shops.map(shop=>`<option value="${safe(shop.shopId)}">${safe(shop.shopName||'Loja '+shop.shopId)}</option>`).join(''):'<option value="">Nenhuma loja conectada</option>';
  chooser.innerHTML=html;chooser.value=state.demo?'':state.shopId;
  el('integrationBadge').textContent=state.demo?'Modo demonstração':state.shops.length?`${state.shops.length} loja(s) autorizada(s)`:'Aguardando autorização';
  el('overviewSubtitle').textContent=state.demo?'Uma prévia com dados ilustrativos da sua operação.':state.shopId?'Acompanhe o movimento da sua loja Shopee.':'Conecte sua loja para ver produtos, pedidos e recebimentos.';
}
function navigate(page,{hash=true}={}){
  if(!labels[page])page='painel';document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===`page-${page}`));
  document.querySelectorAll('.nav-link').forEach(n=>n.classList.toggle('active',n.dataset.page===page));el('breadcrumbPage').textContent=labels[page];
  if(hash)history.replaceState(null,'',`#${page}`);closeSidebar();window.scrollTo({top:0,behavior:'smooth'});
  if(page==='produtos')loadProducts();if(page==='pedidos')loadOrders();if(page==='financeiro')loadFinance();if(page==='publicar'){loadTaxonomy();loadDrafts();}
  if(page==='integracoes')renderShops();drawChart();
}
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));
document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.go)));
window.addEventListener('hashchange',()=>navigate(location.hash.slice(1),{hash:false}));
const initialPage=labels[location.hash.slice(1)]?location.hash.slice(1):'painel';navigate(initialPage,{hash:false});
function openSidebar(){el('sidebar').classList.add('open');el('mobileShade').hidden=false;}
function closeSidebar(){el('sidebar').classList.remove('open');el('mobileShade').hidden=true;}
el('openSidebar').onclick=openSidebar;el('closeSidebar').onclick=closeSidebar;el('mobileShade').onclick=closeSidebar;

function openAuth(){el('authModal').hidden=false;el('authEmail').focus();}
function closeAuth(){el('authModal').hidden=true;}
el('closeAuth').onclick=closeAuth;document.querySelectorAll('[data-close-auth]').forEach(x=>x.onclick=closeAuth);
for (const id of ['accountButton','settingsLogin','demoNoteLogin'])el(id).addEventListener('click',()=>{if(state.user&&id==='accountButton'){navigate('ajustes');return;}openAuth()});
el('googleLogin').onclick=async()=>{try{await signInWithPopup(auth,googleProvider);closeAuth();toast('Login concluído com sucesso!','success');}catch(e){toast(formatError(e),'error')}};
el('authSwitch').onclick=()=>{authSignup=!authSignup;el('authTitle').textContent=authSignup?'Crie sua conta.':'Sua loja começa aqui.';el('emailAuthSubmit').textContent=authSignup?'Criar conta':'Entrar na conta';el('authSwitchPrompt').textContent=authSignup?'Já possui uma conta?':'Ainda não tem conta?';el('authSwitch').textContent=authSignup?'Entrar':'Criar conta';};
el('emailAuthForm').addEventListener('submit',async e=>{e.preventDefault();const email=el('authEmail').value.trim(),password=el('authPassword').value;try{if(authSignup)await createUserWithEmailAndPassword(auth,email,password);else await signInWithEmailAndPassword(auth,email,password);closeAuth();toast('Conta autenticada.','success');}catch(err){toast(formatError(err),'error');}});
el('settingsLogout').onclick=async()=>{await signOut(auth);toast('Você saiu da conta.');};
onAuthStateChanged(auth,async user=>{
  const different=state.user?.uid!==user?.uid;state.user=user;
  if(user){if(different){state.shops=[];setDemo(false,{quiet:true});}else{updateModeUI();}}
  else{state.shops=[];setDemo(true,{quiet:true});}
  updateModeUI();
  if(new URLSearchParams(location.search).has('connected')){history.replaceState({},'',location.pathname+location.hash);if(user)toast('Autorização recebida. Verificando loja...','success');}
});

function renderAll(){updateModeUI();renderKPIs();renderOrders();renderProducts();renderFinance();renderShops();renderDrafts();drawChart();}
function renderKPIs(){
  let ord=state.orders||[],prods=state.products||[],fin=state.finance||{};
  el('kpiOrders').textContent=state.demo||state.shopId?ord.length:'—';
  const amounts=ord.filter(o=>Number.isFinite(Number(o.total_amount)));el('kpiRevenue').textContent=amounts.length?money(amounts.reduce((s,o)=>s+Number(o.total_amount),0)):'—';
  el('kpiPending').textContent=fin.pending_amount!=null?money(fin.pending_amount):'—';
  el('kpiActive').textContent=state.demo||state.shopId?prods.filter(p=>p.item_status==='NORMAL').length:'—';
  el('navProducts').textContent=state.demo||state.shopId?String(prods.length):'—';
  el('balanceMain').textContent=fin.pending_amount!=null?money(fin.pending_amount):'—';
  el('balancePending').textContent=fin.pending_amount!=null?money(fin.pending_amount):'—';
  el('balanceReleased').textContent=fin.released_amount!=null?money(fin.released_amount):'—';
  const pending=Number(fin.pending_amount)||0, released=Number(fin.released_amount)||0;
  el('balanceProgress').style.width=pending+released>0?Math.min(100,100*pending/(pending+released))+'%':'0%';
  el('chartFootnote').textContent=state.demo?'Dados fictícios':state.lastSynced?'Sincronizado às '+state.lastSynced.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'Aguardando sincronização';
}
function statusFor(s){let status=String(s||'').toUpperCase();if(['NORMAL','COMPLETED','SHIPPED'].includes(status))return {text:{NORMAL:'Ativo',COMPLETED:'Concluído',SHIPPED:'Enviado'}[status],color:'good'};if(['READY_TO_SHIP','PROCESSED','TO_CONFIRM_RECEIVE','INVOICE_PENDING'].includes(status))return {text:{READY_TO_SHIP:'Preparar envio',PROCESSED:'Processando',TO_CONFIRM_RECEIVE:'Aguardando recebimento',INVOICE_PENDING:'Nota pendente'}[status],color:'warn'};if(['CANCELLED','BANNED'].includes(status))return {text:'Cancelado / bloqueado',color:'bad'};return {text:status==='UNLIST'?'Não listado':status||'Desconhecido',color:'neutral'}};
function badgeStatus(s){const x=statusFor(s);return `<span class="status-pill ${x.color}">${safe(x.text)}</span>`}
function emptyView(text,sub,ico='box'){return `<div class="empty-view"><span>${svg(ico)}</span><strong>${safe(text)}</strong><p>${safe(sub)}</p></div>`;}
function renderOrders(){
  let ord=state.orders||[];const table=ord.length?`<table class="data-table"><thead><tr><th>Pedido</th><th>Data</th><th>Status</th><th>Valor</th></tr></thead><tbody>${ord.map(o=>`<tr><td class="table-strong">${safe(o.order_sn)}</td><td>${safe(dateBR(o.create_time))}</td><td>${badgeStatus(o.order_status)}</td><td class="table-strong">${o.total_amount!=null?money(o.total_amount):'—'}</td></tr>`).join('')}</tbody></table>`:emptyView('Nenhum pedido encontrado',state.demo?'Veja os exemplos após ativar o modo demonstração.':'Conecte uma loja ou sincronize os últimos 14 dias.','bag');
  el('recentOrders').innerHTML=ord.length?`<table class="data-table"><thead><tr><th>Pedido</th><th>Data</th><th>Status</th><th>Valor</th></tr></thead><tbody>${ord.slice(0,4).map(o=>`<tr><td class="table-strong">${safe(o.order_sn)}</td><td>${safe(dateBR(o.create_time))}</td><td>${badgeStatus(o.order_status)}</td><td>${o.total_amount!=null?money(o.total_amount):'—'}</td></tr>`).join('')}</tbody></table>`:emptyView('Nenhum pedido encontrado','Conecte sua loja para ver as movimentações.','bag');
  el('ordersTable').innerHTML=table;el('ordersSummary').textContent=state.demo?'Exemplos fictícios':`${ord.length} pedido(s) retornado(s) pela API. Consulta limitada aos últimos 14 dias.`;
}
function renderProducts(){const query=el('productSearch').value.trim().toLowerCase(),arr=(state.products||[]).filter(p=>!query||String(p.item_name||'').toLowerCase().includes(query)||String(p.item_id).includes(query));
  el('productsTable').innerHTML=arr.length?`<table class="data-table"><thead><tr><th>Produto</th><th>ID Shopee</th><th>Preço</th><th>Estoque</th><th>Status</th><th>Ação</th></tr></thead><tbody>${arr.map(p=>{const img=safeUrl(p.image_url);return `<tr><td><div class="table-product">${img?`<img class="thumb" src="${safe(img)}" alt="">`:`<span class="thumb thumb-fallback">${svg('box')}</span>`}<span class="truncate-cell table-strong" title="${safe(p.item_name)}">${safe(p.item_name||'Sem nome')}</span></div></td><td>${safe(p.item_id)}</td><td class="table-strong">${p.price!=null?money(p.price):'—'}</td><td>${p.stock!=null?safe(p.stock):'—'}</td><td>${badgeStatus(p.item_status)}</td><td>${!state.demo&&state.shopId?`<a href="https://shopee.com.br/product/${encodeURIComponent(state.shopId)}/${encodeURIComponent(p.item_id)}" target="_blank" rel="noopener noreferrer" class="text-btn">Abrir ↗</a>`:'<span class="muted">Prévia</span>'}</td></tr>`}).join('')}</tbody></table>`:emptyView('Nenhum produto para mostrar',query?'Experimente outro termo de pesquisa.':'Conecte sua loja ou crie o primeiro anúncio.');}
el('productSearch').oninput=renderProducts;
function renderFinance(){const f=state.finance||{};el('finPending').textContent=f.pending_amount!=null?money(f.pending_amount):'—';el('finReleased').textContent=f.released_amount!=null?money(f.released_amount):'—';
  if(state.financeError)el('financialUpdated').textContent=state.financeError;
  else el('financialUpdated').textContent=state.demo?'Dados financeiros fictícios para demonstração':'Panorama oficial de receitas e repasses, quando permitido pela API';
  const rows=f.records||[];el('incomeTable').innerHTML=rows.length?`<table class="data-table"><thead><tr><th>Pedido</th><th>Status de repasse</th><th>Valor informado</th><th>Data</th></tr></thead><tbody>${rows.map(r=>`<tr><td class="table-strong">${safe(r.order_sn)}</td><td>${badgeStatus(r.income_status==='released'?'COMPLETED':'READY_TO_SHIP')}</td><td class="table-strong">${r.amount!=null?money(r.amount):'—'}</td><td>${safe(dateBR(r.payout_time))}</td></tr>`).join('')}</tbody></table>`:emptyView('Sem detalhamento financeiro',state.demo?'Os exemplos ilustram apenas totais, não transações reais.':state.financeError?'API financeira não liberada para esta conta.':'Consulte o panorama de valores ou habilite a permissão financeira do aplicativo.','wallet');
}
function renderShops(){const shops=state.shops||[];el('connectedShops').innerHTML=state.demo?`<div class="soft-note">Você está visualizando uma prévia. Saia do modo demonstração para conectar a loja.</div>`:shops.length?shops.map(s=>`<div class="connected-shop"><div><strong>${safe(s.shopName||'Loja '+s.shopId)}</strong><small>ID ${safe(s.shopId)} • ${safe(s.region||'BR')}</small></div><button data-disconnect="${safe(s.shopId)}">Desvincular</button></div>`).join(''):`<div class="soft-note">Nenhuma loja conectada. Autorize sua conta para sincronizar dados reais.</div>`;
  el('connectedShops').querySelectorAll('[data-disconnect]').forEach(btn=>btn.onclick=()=>disconnectShop(btn.dataset.disconnect));
}
async function disconnectShop(shopId){if(!state.user)return openAuth();const confirm=await showConfirm('Desvincular loja?',`A loja ${shopId} deixará de ser acessível pelo painel. Para revogar também no Shopee, use o portal oficial.`,'Desvincular');if(!confirm)return;
  try{await invoke('disconnectShop',{shopId});state.shops=state.shops.filter(s=>s.shopId!==shopId);state.shopId=state.shops[0]?.shopId||'';state.liveDataLoaded=false;renderAll();if(state.shopId)loadLive();toast('Loja desvinculada deste painel.','success');}catch(e){toast(formatError(e),'error')}
}
function chartData(){let days=[];for(let i=13;i>=0;i--){let d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-i);days.push({key:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,label:`${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`,count:0});}
  for(const order of state.orders){if(!order.create_time)continue;let day=days.find(d=>d.key===dayKey(order.create_time));if(day)day.count++;}return days;
}
function drawChart(){let canvas=el('salesChart');if(!canvas)return;let wrap=canvas.parentElement;let w=wrap.clientWidth,h=wrap.clientHeight;if(!w||!h)return;
  const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);let ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);ctx.clearRect(0,0,w,h);
  const days=chartData(),max=Math.max(3,...days.map(d=>d.count)),left=35,right=10,top=19,bottom=31,gh=h-top-bottom,gw=w-left-right,gridColor=getComputedStyle(document.documentElement).getPropertyValue('--line').trim()||'#eee';ctx.font='10px DM Sans, sans-serif';ctx.textBaseline='middle';
  for(let n=0;n<=3;n++){let y=top+gh*n/3;ctx.strokeStyle=gridColor;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();ctx.fillStyle='#a6a1aa';ctx.textAlign='right';ctx.fillText(String(Math.round(max*(3-n)/3)),left-11,y);}
  const coords=days.map((d,i)=>({x:left+gw*i/(days.length-1),y:top+gh*(1-d.count/max),...d}));
  let grd=ctx.createLinearGradient(0,top,0,h-bottom);grd.addColorStop(0,'rgba(238,77,45,.18)');grd.addColorStop(1,'rgba(238,77,45,0)');ctx.fillStyle=grd;ctx.beginPath();ctx.moveTo(coords[0].x,h-bottom);for(let i=0;i<coords.length;i++){if(i===0)ctx.lineTo(coords[i].x,coords[i].y);else{let prev=coords[i-1],cur=coords[i];let mx=(prev.x+cur.x)/2;ctx.bezierCurveTo(mx,prev.y,mx,cur.y,cur.x,cur.y)}}ctx.lineTo(coords.at(-1).x,h-bottom);ctx.closePath();ctx.fill();
  ctx.lineWidth=2.9;ctx.strokeStyle='#ee4d2d';ctx.beginPath();coords.forEach((p,i)=>{if(i===0)ctx.moveTo(p.x,p.y);else{let prev=coords[i-1],mx=(prev.x+p.x)/2;ctx.bezierCurveTo(mx,prev.y,mx,p.y,p.x,p.y)}});ctx.stroke();
  coords.forEach((p,i)=>{if(i%3===0||i===coords.length-1){ctx.fillStyle='#aaa4ad';ctx.font='10px DM Sans, sans-serif';ctx.textAlign='center';ctx.fillText(p.label,p.x,h-12)}if(p.count>0){ctx.beginPath();ctx.arc(p.x,p.y,3.3,0,2*Math.PI);ctx.fillStyle='#fff';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#ee4d2d';ctx.stroke();}});
  state.chartPoints=coords;
}
el('salesChart').onmousemove=e=>{let rect=e.target.getBoundingClientRect(),x=e.clientX-rect.left,pt=state.chartPoints.reduce((a,b)=>Math.abs(b.x-x)<Math.abs(a.x-x)?b:a,state.chartPoints[0]);if(!pt)return;const t=el('chartTooltip');t.textContent=`${pt.label} · ${pt.count} pedido(s)`;t.style.left=Math.max(10,Math.min(rect.width-138,pt.x-42))+'px';t.style.top=Math.max(0,pt.y-37)+'px';t.hidden=false;};
el('salesChart').onmouseleave=()=>el('chartTooltip').hidden=true;window.addEventListener('resize',drawChart);

async function fetchShops(){const result=await invoke('getSession');state.shops=(result?.shops||[]).map(x=>({shopId:String(x.shopId),shopName:x.shopName,region:x.region}));
  const old=state.shopId;if(!state.shops.some(s=>s.shopId===old))state.shopId=state.shops[0]?.shopId||'';updateModeUI();renderShops();}
async function loadLive(refreshShops=false){if(state.demo||!state.user)return;if(fetchingPromise)return fetchingPromise;
  fetchingPromise=(async()=>{setBusy(true);try{
    if(refreshShops||!state.shops.length)await fetchShops();
    if(!state.shopId){state.orders=[];state.products=[];state.finance=null;state.liveDataLoaded=true;renderAll();return;}
    const result=await invoke('getDashboard',{shopId:state.shopId});
    state.orders=Array.isArray(result.orders)?result.orders:[];state.products=Array.isArray(result.products)?result.products:[];
    state.finance=result.finance||null;state.financeError=result.financeError||'';if(document.getElementById('page-financeiro').classList.contains('active')&&state.finance){invoke('getIncomeDetails',{shopId:state.shopId}).then(r=>{if(state.finance){state.finance.records=r.records||[];renderFinance();}}).catch(()=>{});}state.lastSynced=new Date();state.liveDataLoaded=true;renderAll();
    if(result.warnings?.length)toast('Alguns dados não foram carregados: '+result.warnings.slice(0,2).join(' · '));
  }catch(e){toast(formatError(e),'error');renderAll()}finally{setBusy(false);fetchingPromise=null}})();return fetchingPromise;
}
function requestSync(){if(state.demo){toast('Você está vendo dados de demonstração. Para sincronizar, entre e conecte uma loja.');return;}loadLive(true);}
for(const id of ['syncTop','reloadProducts','reloadOrders','reloadFinance','settingsSync'])el(id).onclick=requestSync;
function loadProducts(){if(!state.demo&&!state.liveDataLoaded)loadLive();}
function loadOrders(){if(!state.demo&&!state.liveDataLoaded)loadLive();}
async function loadFinance(){
  if(state.demo||!state.user)return;
  if(!state.liveDataLoaded)await loadLive();
  if(!state.shopId||!state.finance)return;
  try{const shopId=state.shopId;const response=await invoke('getIncomeDetails',{shopId});
    if(shopId!==state.shopId)return;
    state.finance.records=response.records||[];renderFinance();
  }catch(e){toast('O detalhamento financeiro não está disponível: '+formatError(e));}
}
el('shopSelect').onchange=e=>{if(state.demo)return;state.shopId=e.target.value;state.liveDataLoaded=false;state.orders=[];state.products=[];state.finance=null;renderAll();loadLive();};
el('connectShopee').onclick=connectShopee;el('tipConnect').onclick=()=>{if(!state.user)return openAuth();if(state.demo){setDemo(false);navigate('integracoes');}else connectShopee();};
async function connectShopee(){if(!state.user)return openAuth();if(state.demo){setDemo(false);navigate('integracoes');return;}
  try{const result=await invoke('startShopeeAuth');if(!result.url||!result.url.startsWith('https://'))throw Error('URL de autorização inválida');window.location.assign(result.url)}catch(e){toast(formatError(e),'error');}
}

function showConfirm(title,text,button='Confirmar'){
  el('confirmTitle').textContent=title;el('confirmText').textContent=text;el('acceptConfirm').textContent=button;el('confirmModal').hidden=false;
  return new Promise(resolve=>{resolverConfirm=resolve;});
}
function finishConfirm(result){el('confirmModal').hidden=true;if(resolverConfirm){resolverConfirm(result);resolverConfirm=null;}}
el('acceptConfirm').onclick=()=>finishConfirm(true);el('cancelConfirm').onclick=()=>finishConfirm(false);document.querySelectorAll('[data-close-confirm]').forEach(x=>x.onclick=()=>finishConfirm(false));
window.addEventListener('keydown',e=>{if(e.key==='Escape'){closeAuth();finishConfirm(false);closeSidebar();}});

// Publication wizard
function selectedFiles(list){const files=Array.from(list||[]).filter(f=>['image/jpeg','image/png','image/webp'].includes(f.type)&&f.size<=5*1024*1024);const remaining=9-state.uploadFiles.length;if(!remaining){toast('É possível adicionar no máximo 9 fotos.');return;}
  state.uploadFiles=[...state.uploadFiles,...files.slice(0,remaining)];renderImages();if(files.length!==Array.from(list||[]).length)toast('Algumas imagens foram ignoradas (formato inválido ou acima de 5 MB).','error');}
el('imagesInput').addEventListener('change',e=>{selectedFiles(e.target.files);e.target.value='';});
function renderImages(){el('imagePreview').innerHTML='';state.uploadFiles.forEach((file,index)=>{const f=document.createElement('figure'),src=URL.createObjectURL(file);f.innerHTML=`<img alt="Prévia da imagem ${index+1}"><button type="button" aria-label="Remover foto">×</button>`;f.querySelector('img').src=src;f.querySelector('img').onload=()=>URL.revokeObjectURL(src);f.querySelector('button').onclick=()=>{state.uploadFiles.splice(index,1);renderImages()};el('imagePreview').appendChild(f)});
  const preview=el('previewMedia');preview.innerHTML='';if(state.uploadFiles.length){const img=document.createElement('img'),src=URL.createObjectURL(state.uploadFiles[0]);img.src=src;img.alt='Primeira imagem do produto';img.onload=()=>URL.revokeObjectURL(src);preview.appendChild(img)}else preview.innerHTML=svg('image')+'<span>Imagem do produto</span>';
  el('uploadedCount').textContent=`${state.uploadFiles.length} de 9 imagens selecionadas. As fotos serão enviadas apenas após confirmar a publicação.`;
}
function renderFormPreview(){el('previewTitle').textContent=el('itemName').value.trim()||'O título do seu produto aparecerá aqui';el('previewPrice').textContent=el('originalPrice').value?money(el('originalPrice').value):'R$ —';el('previewStock').textContent=el('stock').value||'—';el('previewStatus').textContent=el('publishNow').checked?'Publicar':'Não listado';}
el('publishForm').addEventListener('input',renderFormPreview);el('publishNow').addEventListener('change',renderFormPreview);
async function loadTaxonomy(){if(state.demo||!state.user||!state.shopId){el('categoryId').innerHTML='<option value="">Conecte a loja para carregar</option>';el('shippingOptions').innerHTML='<div class="subtle-placeholder">Os canais de entrega aparecem após conectar a loja real.</div>';return;}
  if(el('categoryId').dataset.shop===state.shopId)return;
  el('categoryId').innerHTML='<option value="">Carregando categorias...</option>';
  try{const r=await invoke('getPublishOptions',{shopId:state.shopId});const categories=r.categories||[],logistics=r.logistics||[];
    el('categoryId').innerHTML='<option value="">Selecione uma categoria</option>'+categories.filter(x=>!x.has_children).sort((a,b)=>String(a.name).localeCompare(String(b.name),'pt-BR')).map(x=>`<option value="${safe(x.id)}">${safe(x.name)}</option>`).join('');
    el('categoryId').dataset.shop=state.shopId;
    el('shippingOptions').innerHTML=logistics.length?logistics.filter(l=>l.enabled!==false).map(l=>`<label class="shipping-option"><input type="checkbox" data-logistic="${safe(l.id)}" data-fee="${safe(l.fee_type||'')}" ${l.sizes?.length?`data-size="${safe(l.sizes[0].size_id)}"`:''}> ${safe(l.name)}</label>`).join(''):'<div class="subtle-placeholder">Nenhum canal logístico foi retornado pela loja. Ative uma forma de envio na Shopee.</div>';
    if(!categories.length)toast('A Shopee não retornou categorias disponíveis para o seu aplicativo.','error');
  }catch(e){el('categoryId').innerHTML='<option value="">Falha ao consultar categorias</option>';toast(formatError(e),'error')}
}
function readPublicationForm(){const form={item_name:el('itemName').value.trim(),description:el('description').value.trim(),category_id:Number(el('categoryId').value),item_sku:el('sku').value.trim(),condition:el('condition').value,original_price:Number(el('originalPrice').value),seller_stock:[{stock:Number(el('stock').value)}],weight:Number(el('weight').value),dimension:{package_length:Number(el('pkgLength').value),package_width:Number(el('pkgWidth').value),package_height:Number(el('pkgHeight').value)},item_status:el('publishNow').checked?'NORMAL':'UNLIST',logistic_info:Array.from(el('shippingOptions').querySelectorAll('input:checked')).map(i=>{const out={logistic_id:Number(i.dataset.logistic),enabled:true};if(i.dataset.fee==='SIZE_SELECTION'&&i.dataset.size)out.size_id=Number(i.dataset.size);return out}),tax_info:{}};
  const ncm=el('ncm').value.trim();if(ncm)form.tax_info.ncm=ncm; if(!ncm)delete form.tax_info;
  const attr=el('attributesJson').value.trim();if(attr){try{const parsed=JSON.parse(attr);if(!Array.isArray(parsed))throw Error('O campo Atributos precisa ser uma lista JSON.');form.attribute_list=parsed;}catch(e){throw Error('JSON dos atributos inválido: '+e.message);}}
  if(el('brandId').value)form.brand={brand_id:Number(el('brandId').value),original_brand_name:el('brandName').value.trim()||'Sem marca'};
  return form;
}
function validForm(){const form=el('publishForm');if(!form.reportValidity())return false;if(!state.demo&&(!el('categoryId').value||!el('shippingOptions').querySelector('input:checked'))){toast('Selecione uma categoria e ao menos uma forma de envio.','error');return false;}if(state.uploadFiles.length===0&&!state.demo){toast('Adicione pelo menos uma imagem do produto.','error');return false;}return true;}
function fileBase64(file){return new Promise((res,rej)=>{let reader=new FileReader();reader.onload=()=>res(String(reader.result).split(',')[1]);reader.onerror=()=>rej(new Error('Erro ao ler imagem'));reader.readAsDataURL(file);});}
el('publishForm').addEventListener('submit',async e=>{
  e.preventDefault();if(state.demo){toast('A demonstração não publica anúncios. Conecte uma loja real para enviar o produto.');return;}
  if(!state.user)return openAuth();if(!state.shopId){navigate('integracoes');toast('Conecte uma loja antes de publicar.');return;}if(!validForm())return;
  let payload;try{payload=readPublicationForm()}catch(err){toast(err.message,'error');return;}
  const proceed=await showConfirm('Enviar produto à Shopee?',`O anúncio “${payload.item_name}” será ${payload.item_status==='NORMAL'?'publicado':'enviado como não listado'} na loja selecionada. A Shopee ainda validará os dados de categoria e logística.`,'Enviar anúncio');if(!proceed)return;
  el('submitPublish').disabled=true;let originalText=el('submitPublish').innerHTML;try{
    const imageIds=[];for(let i=0;i<state.uploadFiles.length;i++){
      el('submitPublish').textContent=`Enviando foto ${i+1} de ${state.uploadFiles.length}...`;
      const file=state.uploadFiles[i],base64=await fileBase64(file);
      const resp=await invoke('uploadShopeeImage',{shopId:state.shopId,mimeType:file.type,fileName:file.name,base64});imageIds.push(resp.image_id);
    }
    payload.image={image_id_list:imageIds};el('submitPublish').textContent='Publicando produto...';
    const result=await invoke('publishProduct',{shopId:state.shopId,product:payload});
    toast(`Produto enviado à Shopee! ID: ${result.item_id}`,'success');state.liveDataLoaded=false;resetForm();navigate('produtos');await loadLive();
  }catch(err){toast(formatError(err),'error')}finally{el('submitPublish').disabled=false;el('submitPublish').innerHTML=originalText;}
});
function resetForm(){el('publishForm').reset();state.uploadFiles=[];renderImages();renderFormPreview();}
el('resetPublish').onclick=resetForm;
function serializeDraft(){const ids=['itemName','description','categoryId','sku','condition','ncm','originalPrice','stock','weight','pkgLength','pkgWidth','pkgHeight','attributesJson','brandId','brandName'];let values={};ids.forEach(id=>values[id]=el(id).value);values.publishNow=el('publishNow').checked;values.logistics=Array.from(el('shippingOptions').querySelectorAll('input:checked')).map(i=>i.dataset.logistic);return values;}
function restoreDraft(values){Object.entries(values||{}).forEach(([k,v])=>{if(k==='publishNow')el(k).checked=Boolean(v);else if(k==='logistics'){Array.from(el('shippingOptions').querySelectorAll('input')).forEach(i=>i.checked=v.includes(i.dataset.logistic));}else if(el(k))el(k).value=v??''});state.uploadFiles=[];renderImages();renderFormPreview();navigate('publicar');toast('Rascunho carregado. Reenvie as fotos antes de publicar.');}
el('saveDraft').onclick=async()=>{const d=serializeDraft(),title=String(d.itemName||'Produto sem título').slice(0,120);if(state.demo){state.drafts.unshift({id:String(Date.now()),title,values:d,updatedAt:Date.now()});state.drafts=state.drafts.slice(0,30);localStorage.setItem('shopeeStudioDemoDrafts',JSON.stringify(state.drafts));renderDrafts();toast('Rascunho salvo apenas neste navegador (demonstração).','success');return;}if(!state.user)return openAuth();
  try{await invoke('saveProductDraft',{shopId:state.shopId||null,values:d});await loadDrafts();toast('Rascunho salvo na sua conta.','success');}catch(e){toast(formatError(e),'error')}
};
async function loadDrafts(){if(state.demo){state.drafts=JSON.parse(localStorage.getItem('shopeeStudioDemoDrafts')||'[]');renderDrafts();return;}if(!state.user)return;try{const r=await invoke('listProductDrafts');state.drafts=r.drafts||[];renderDrafts();}catch(e){toast(formatError(e),'error')}}
function renderDrafts(){el('draftCount').textContent=state.drafts.length;el('draftList').innerHTML=state.drafts.length?state.drafts.map((d,i)=>`<div class="draft-row"><div style="flex:1;min-width:0"><strong>${safe(d.title)}</strong><small>${d.updatedAt?new Date(d.updatedAt).toLocaleDateString('pt-BR'):'Rascunho salvo'}</small></div><button data-draft-open="${i}">Abrir</button><button data-draft-remove="${i}" aria-label="Excluir rascunho">×</button></div>`).join(''):'<p class="muted" style="font-size:11px">Nenhum rascunho salvo.</p>';
  el('draftList').querySelectorAll('[data-draft-open]').forEach(b=>b.onclick=()=>restoreDraft(state.drafts[Number(b.dataset.draftOpen)].values));
  el('draftList').querySelectorAll('[data-draft-remove]').forEach(b=>b.onclick=async()=>{const d=state.drafts[Number(b.dataset.draftRemove)];if(state.demo){state.drafts=state.drafts.filter(x=>x.id!==d.id);localStorage.setItem('shopeeStudioDemoDrafts',JSON.stringify(state.drafts));renderDrafts();return;}try{await invoke('deleteProductDraft',{draftId:d.id});await loadDrafts();}catch(e){toast(formatError(e),'error')}});
}

el('exportReport').onclick=()=>{
  const orders=state.orders||[];if(!orders.length){toast('Não há pedidos para exportar.');return;}
  const rows=[['Pedido','Data','Status','Valor (R$)'],...orders.map(o=>[o.order_sn,dateBR(o.create_time),o.order_status,o.total_amount??''])];
  const csv='\ufeff'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/^[=+@\-]/, "'&").replace(/"/g,'""')+'"').join(';')).join('\r\n');const link=document.createElement('a');let url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));link.href=url;link.download=`shopee-studio-${state.demo?'EXEMPLO-':''}pedidos-${new Date().toISOString().slice(0,10)}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1200);
};
renderImages();setDemo(true,{quiet:true});