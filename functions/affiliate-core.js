'use strict';
const crypto = require('node:crypto');

const AFFILIATE_API = 'https://open-api.affiliate.shopee.com.br/graphql';
const CATEGORIES = ['Casa','Eletrônicos','Moda','Beleza','Esportes','Games','Acessórios','Lojas','Outros'];
const permittedShopeeHost = host => /(^|\.)(shopee\.com\.br|shopee\.com|shp\.ee|shope\.ee)$/i.test(host);

function shopeeUrl(value) {
  if (typeof value !== 'string' || value.length > 1200) throw new Error('Informe um link válido da Shopee.');
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('Informe um link válido da Shopee.'); }
  if (url.protocol !== 'https:' || !permittedShopeeHost(url.hostname) || url.port || url.username || url.password) {
    throw new Error('O link deve ser HTTPS e pertencer à Shopee.');
  }
  url.hash = '';
  return url.toString();
}
function imageUrl(value) {
  if (!value) return '';
  if (typeof value !== 'string' || value.length > 1400) throw new Error('URL da imagem inválida.');
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) throw new Error();
    return url.toString();
  } catch { throw new Error('A imagem deve ser um endereço HTTPS.'); }
}
function field(value, max, label, required=false) {
  const cleaned = String(value ?? '').replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '').trim().slice(0, max);
  if (required && !cleaned) throw new Error('Informe '+label+'.');
  return cleaned;
}
function currencyValue(value) {
  if (value === null || value === '' || value === undefined) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0 || num > 1e8) throw new Error('Preço inválido.');
  return Math.round(num*100)/100;
}
function category(value) {return CATEGORIES.includes(value) ? value : 'Outros';}
function slugify(value) {return field(value,80,'nome').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,44)||'minha-loja';}
function signature(appId, secret, body, timestamp) {
  return crypto.createHash('sha256').update(`${appId}${timestamp}${body}${secret}`, 'utf8').digest('hex');
}
function signedHeaders(appId, secret, body, timestamp) {
  return {'Content-Type':'application/json','Authorization':`SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature(appId,secret,body,timestamp)}`};
}
function encrypt(value, hexKey) {
  if (!/^[0-9a-f]{64}$/i.test(String(hexKey||''))) throw new Error('Chave de criptografia não configurada.');
  const iv=crypto.randomBytes(12); const cipher=crypto.createCipheriv('aes-256-gcm',Buffer.from(hexKey,'hex'),iv);
  const enc=Buffer.concat([cipher.update(String(value),'utf8'),cipher.final()]);
  return [iv.toString('base64'),cipher.getAuthTag().toString('base64'),enc.toString('base64')].join('.');
}
function decrypt(value, hexKey) {
  if(!/^[0-9a-f]{64}$/i.test(String(hexKey||''))) throw new Error('Chave de criptografia não configurada.');
  const parts=String(value||'').split('.');
  if(parts.length!==3)throw new Error('Credencial corrompida.');
  const decipher=crypto.createDecipheriv('aes-256-gcm',Buffer.from(hexKey,'hex'),Buffer.from(parts[0],'base64'));
  decipher.setAuthTag(Buffer.from(parts[1],'base64'));
  return Buffer.concat([decipher.update(Buffer.from(parts[2],'base64')),decipher.final()]).toString('utf8');
}
function gqlString(value) {return JSON.stringify(String(value));}
function queryOffers(keyword, page=1, limit=16) {
  return `{productOfferV2(keyword:${gqlString(keyword)},sortType:1,page:${page},limit:${limit}){nodes{itemId productName productLink offerLink imageUrl priceMin priceMax priceDiscountRate sales ratingStar commissionRate shopId shopName}pageInfo{page limit hasNextPage}}}`;
}
function productIdsFromUrl(link){
 const url=new URL(shopeeUrl(link));
 const path=url.pathname;
 let match=path.match(/\/product\/(\d{1,18})\/(\d{1,18})(?:\/|$)/i)
    || path.match(/-i\.(\d{1,18})\.(\d{1,18})(?:\/|$)/i)
    || path.match(/\/opaanlp\/(\d{1,18})\/(\d{1,18})(?:\/|$)/i);
 if(!match){
  const shopId=url.searchParams.get('shopid')||url.searchParams.get('shopId');
  const itemId=url.searchParams.get('itemid')||url.searchParams.get('itemId');
  if(shopId&&itemId)match=[null,shopId,itemId];
 }
 if(!match||!/^[0-9]{1,18}$/.test(match[1])||!/^[0-9]{1,18}$/.test(match[2]))return null;
 return {shopId:match[1],itemId:match[2]};
}
function queryOfferByItemId(itemId){
 if(!/^[0-9]{1,18}$/.test(String(itemId)))throw new Error('ID do produto Shopee inválido.');
 return `{productOfferV2(itemId:${itemId},page:1,limit:2){nodes{itemId productName productLink offerLink imageUrl priceMin priceMax priceDiscountRate sales ratingStar commissionRate shopId shopName}pageInfo{page limit hasNextPage}}}`;
}
function queryShortLink(url, subIds=[]) {
  return `mutation{generateShortLink(input:{originUrl:${gqlString(shopeeUrl(url))},subIds:[${subIds.map(gqlString).join(',')}]}){shortLink}}`;
}
function queryReport(from,to,scrollId='') {
  const next=scrollId?`,scrollId:${gqlString(scrollId)}`:'';
  return `{conversionReport(purchaseTimeStart:${from},purchaseTimeEnd:${to},limit:100${next}){nodes{conversionId purchaseTime totalCommission utmContent orders{orderId orderStatus}}pageInfo{hasNextPage scrollId}}}`;
}
async function callAffiliate({appId,secret,query,fetcher=fetch}) {
  const body=JSON.stringify({query}); const ts=Math.floor(Date.now()/1000);
  const response=await fetcher(AFFILIATE_API,{method:'POST',headers:signedHeaders(appId,secret,body,ts),body,signal:AbortSignal.timeout(15000)});
  const output=await response.json().catch(()=>null);
  if (!response.ok || !output) throw new Error(`A API Shopee não respondeu corretamente (${response.status}).`);
  if (Array.isArray(output.errors) && output.errors.length) {
    const message=String(output.errors[0]?.message||'Erro desconhecido na API Shopee').slice(0,250);
    throw new Error('API Shopee: '+message);
  }
  return output.data || {};
}
function mapOffer(p) {
  return {
    itemId:String(p.itemId||''),shopId:String(p.shopId||''),
    name:field(p.productName,180,'nome'), shopName:field(p.shopName,90,'loja'),
    originalUrl:shopeeUrl(p.productLink),
    // offerLink may already contain the caller's affiliate tracking; never use it as an origin URL.
    affiliateUrl:p.offerLink ? shopeeUrl(p.offerLink) : '',
    image:imageUrl(p.imageUrl),price:currencyValue(p.priceMin),
    commissionRate:Number(p.commissionRate)||0, sales:Number(p.sales)||0,
    rating:Number(p.ratingStar)||0,
  };
}
function summarizeConversions(nodes,limitReached=false,uidMarker='') {
  let total=0, pending=0, completed=0, cancelled=0, orders=0, siteTotal=0;
  const seen=new Set();
  for (const n of nodes) {
    const id=String(n.conversionId||''); if(id && seen.has(id))continue;
    if(id)seen.add(id);
    const amount=Number(n.totalCommission)||0;
    total+=amount;
    const statuses=(n.orders||[]).map(o=>String(o.orderStatus||'').toUpperCase());
    orders += statuses.length;
    if(statuses.length && statuses.every(s=>s==='COMPLETED'))completed+=amount;
    else if(statuses.length && statuses.every(s=>s==='CANCELLED'))cancelled+=amount;
    else pending+=amount;
    const attribution=String(n.utmContent||'').toLowerCase();
    if(attribution.includes('shopeepanel')&&(!uidMarker||attribution.includes(String(uidMarker).toLowerCase())))siteTotal+=amount;
  }
  return {total,completed,pending,cancelled,siteTotal,orders,conversions:seen.size,partial:!!limitReached};
}
module.exports={AFFILIATE_API,CATEGORIES,shopeeUrl,imageUrl,field,currencyValue,category,slugify,signature,signedHeaders,encrypt,decrypt,gqlString,queryOffers,productIdsFromUrl,queryOfferByItemId,queryShortLink,queryReport,callAffiliate,mapOffer,summarizeConversions};