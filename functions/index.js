'use strict';
/**
 * Integração OPCIONAL com a Open API de Afiliados Shopee.
 * A criação de lojas, edição e publicação com links já convertidos são feitas
 * diretamente no Firebase Realtime Database pelo navegador autenticado.
 * Esta função apenas faz chamadas que precisam de credenciais secretas.
 */
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {setGlobalOptions}=require('firebase-functions/v2');
const {defineSecret}=require('firebase-functions/params');
const admin=require('firebase-admin');
const core=require('./affiliate-core');

const DATABASE_URL='https://gahepatama-4707c-default-rtdb.firebaseio.com';
admin.initializeApp({databaseURL:DATABASE_URL});
setGlobalOptions({region:'southamerica-east1',maxInstances:10,memory:'256MiB'});
const db=admin.database();
const BASE='shopeePanel/v1';
const r=(path='')=>db.ref(BASE+(path?'/'+path:''));
const encryptionKey=defineSecret('AFFILIATE_ENCRYPTION_KEY');

function verifiedUid(request){
 const uid=request.auth?.uid;
 if(!uid||!/^[A-Za-z0-9_-]{6,160}$/.test(uid))throw new HttpsError('unauthenticated','Faça login com Google antes de continuar.');
 return uid;
}
function handleError(error){
 if(error instanceof HttpsError)return error;
 const message=String(error?.message||'Erro desconhecido ao consultar a Shopee.').slice(0,250);
 console.error('Shopee Affiliate API:',message);
 return new HttpsError('failed-precondition',message);
}
async function getCredentials(uid){
 const snap=await r('affiliateSecrets/'+uid).get();
 if(!snap.exists())return null;
 const data=snap.val();
 return {appId:core.decrypt(data.encryptedAppId,encryptionKey.value()),secret:core.decrypt(data.encryptedSecret,encryptionKey.value())};
}
async function shopExists(uid){
 const snap=await r('shops/'+uid).get();
 if(!snap.exists())throw new HttpsError('failed-precondition','Crie sua vitrine no site antes de publicar produtos.');
 return snap.val();
}

exports.connectAffiliate=onCall({secrets:[encryptionKey],timeoutSeconds:40},async request=>{
 try{
  const uid=verifiedUid(request);
  const appId=core.field(request.data?.appId,100,'App ID',true);
  const secret=core.field(request.data?.secret,300,'Secret',true);
  if(!/^[A-Za-z0-9_-]{3,100}$/.test(appId)||secret.length<6)throw new HttpsError('invalid-argument','App ID ou Secret da API inválido.');
  // A API precisa aceitar as credenciais antes de serem persistidas.
  await core.callAffiliate({appId,secret,query:core.queryOffers('casa',1,1)});
  await shopExists(uid);
  await r().update({
   ['affiliateSecrets/'+uid]:{encryptedAppId:core.encrypt(appId,encryptionKey.value()),encryptedSecret:core.encrypt(secret,encryptionKey.value()),updatedAt:Date.now()},
   ['affiliateStatus/'+uid]:{connected:true,appIdLast4:appId.slice(-4),updatedAt:Date.now()}
  });
  return {ok:true,appIdLast4:appId.slice(-4)};
 }catch(error){throw handleError(error);}
});

exports.disconnectAffiliate=onCall(async request=>{
 try{
  const uid=verifiedUid(request);
  await r().update({['affiliateSecrets/'+uid]:null,['affiliateStatus/'+uid]:null,['affiliateReports/'+uid]:null});
  return {ok:true};
 }catch(error){throw handleError(error);}
});

exports.searchOffers=onCall({secrets:[encryptionKey],timeoutSeconds:45},async request=>{
 try{
  const uid=verifiedUid(request);
  const creds=await getCredentials(uid);
  if(!creds)throw new HttpsError('failed-precondition','Conecte o App ID e Secret da API Shopee em Configurações.');
  const keyword=core.field(request.data?.keyword,80,'termo de busca',true);
  if(keyword.length<2)throw new HttpsError('invalid-argument','Digite pelo menos duas letras para pesquisar.');
  const page=Math.min(5,Math.max(1,Math.trunc(Number(request.data?.page)||1)));
  const result=await core.callAffiliate({...creds,query:core.queryOffers(keyword,page,16)});
  const offers=(result.productOfferV2?.nodes||[]).flatMap(raw=>{try{return [core.mapOffer(raw)];}catch{return [];}});
  return {offers,page,hasNextPage:!!result.productOfferV2?.pageInfo?.hasNextPage};
 }catch(error){throw handleError(error);}
});

exports.publishProduct=onCall({secrets:[encryptionKey],timeoutSeconds:45},async request=>{
 try{
  const uid=verifiedUid(request);
  const creds=await getCredentials(uid);
  if(!creds)throw new HttpsError('failed-precondition','Conecte a API Shopee ou cole um link de afiliado já gerado para publicar sem Functions.');
  const data=request.data||{};
  const name=core.field(data.name,180,'nome do produto',true);
  const description=core.field(data.description,350,'descrição');
  const category=core.category(data.category);
  const originalUrl=core.shopeeUrl(data.originalUrl);
  const image=core.imageUrl(data.image);
  const price=core.currencyValue(data.price);
  const shop=await shopExists(uid);
  const result=await core.callAffiliate({...creds,query:core.queryShortLink(originalUrl,['shopeepanel',uid.slice(0,12)])});
  const affiliateUrl=core.shopeeUrl(result.generateShortLink?.shortLink);
  const product={name,description,category,originalUrl,affiliateUrl,image,trackingSource:'api',published:true,createdAt:Date.now()};
  if(price!==null)product.price=price;
  const ref=r('publicProducts/'+uid).push();
  await ref.set(product);
  // Atualiza apenas o contador visual; não interfere na publicação se falhar.
  try{
   const snap=await r('publicProducts/'+uid).get();
   const count=snap.numChildren();
   const changes={['shops/'+uid+'/productCount']:count};
   if(shop.isPublic)changes['publicShops/'+uid+'/productCount']=count;
   await r().update(changes);
  }catch(error){console.warn('Contagem:',String(error?.message||error));}
  return {ok:true,id:ref.key,affiliateUrl,trackingSource:'api'};
 }catch(error){throw handleError(error);}
});

exports.getReport=onCall({secrets:[encryptionKey],timeoutSeconds:110},async request=>{
 try{
  const uid=verifiedUid(request);
  const creds=await getCredentials(uid);
  if(!creds)throw new HttpsError('failed-precondition','Conecte sua API Shopee para consultar comissões reais.');
  const days=[7,30].includes(Number(request.data?.days))?Number(request.data.days):30;
  const to=Math.floor(Date.now()/1000),from=to-days*86400;
  const nodes=[];let scrollId='',partial=false;
  for(let page=0;page<4;page++){
   const result=await core.callAffiliate({...creds,query:core.queryReport(from,to,scrollId)});
   const report=result.conversionReport||{};
   nodes.push(...(report.nodes||[]));
   if(!report.pageInfo?.hasNextPage)break;
   scrollId=String(report.pageInfo.scrollId||'');
   if(!scrollId||page===3){partial=true;break;}
  }
  const data={connected:true,days,summary:core.summarizeConversions(nodes,partial,uid.slice(0,12)),consultedAt:Date.now()};
  await r('affiliateReports/'+uid).set(data);
  return data;
 }catch(error){throw handleError(error);}
});