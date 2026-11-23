'use strict';
const {onCall,HttpsError}=require('firebase-functions/v2/https');
const {setGlobalOptions}=require('firebase-functions/v2');
const {defineSecret}=require('firebase-functions/params');
const admin=require('firebase-admin');
const core=require('./affiliate-core');
admin.initializeApp();
setGlobalOptions({region:'southamerica-east1',maxInstances:12,memory:'256MiB'});
const db=admin.firestore();
const encryptedKey=defineSecret('AFFILIATE_ENCRYPTION_KEY');
const shops=db.collection('shops');
const secrets=db.collection('affiliateSecrets');

function uidOf(req) {
  if(!req.auth?.uid)throw new HttpsError('unauthenticated','Entre com sua conta Google para continuar.');
  return req.auth.uid;
}
function err(e){
  if(e instanceof HttpsError)return e;
  const message=String(e?.message||'Falha ao processar solicitação.').slice(0,300);
  console.warn('Operação de afiliados não concluída:',message);
  return new HttpsError('failed-precondition',message);
}
async function getCredentials(uid){
  const d=await secrets.doc(uid).get();
  if(!d.exists) return null;
  return {appId:core.decrypt(d.data().encryptedAppId,encryptedKey.value()),secret:core.decrypt(d.data().encryptedSecret,encryptedKey.value())};
}
function safeShopData(d){
  const s=d||{};
  return {name:s.name||'Minha vitrine',description:s.description||'',slug:s.slug||'',isPublic:s.isPublic!==false,referenceUrl:s.referenceUrl||'',productCount:s.productCount||0,ownerUid:s.ownerUid||''};
}
async function ensure(uid, displayName){
  const ref=shops.doc(uid);const current=await ref.get();
  if(!current.exists){
    const name=core.field(displayName,60,'nome')||'Minha vitrine';
    const slug=core.slugify(name)+'-'+uid.slice(0,6).toLowerCase();
    try{await ref.create({ownerUid:uid,name:`Vitrine de ${name.split(' ')[0]}`,slug,description:'Seleção especial de produtos da Shopee.',isPublic:true,referenceUrl:'',productCount:0,createdAt:admin.firestore.FieldValue.serverTimestamp(),updatedAt:admin.firestore.FieldValue.serverTimestamp()});}
    catch(e){if(e?.code!==6&&e?.code!=='already-exists')throw e;}
  }
  return (await ref.get()).data();
}

exports.ensureStore=onCall(async req=>{
  try {
    const uid=uidOf(req);
    const doc=await ensure(uid,req.auth.token.name||'');
    const connected=(await secrets.doc(uid).get()).exists;
    return {shop:safeShopData(doc),connected};
  } catch(e){throw err(e);}
});

exports.updateStore=onCall(async req=>{
  try {
    const uid=uidOf(req);
    await ensure(uid,req.auth.token.name||'');
    const data=req.data||{};
    const name=core.field(data.name,70,'nome da vitrine',true);
    const description=core.field(data.description,240,'descrição');
    const referenceUrl=data.referenceUrl ? core.shopeeUrl(data.referenceUrl):'';
    const isPublic=data.isPublic!==false;
    await shops.doc(uid).update({name,description,referenceUrl,isPublic,updatedAt:admin.firestore.FieldValue.serverTimestamp()});
    return {ok:true};
  } catch(e){throw err(e);}
});

exports.connectAffiliate=onCall({secrets:[encryptedKey],timeoutSeconds:45},async req=>{
  try {
    const uid=uidOf(req);
    const appId=core.field(req.data?.appId,100,'App ID',true);
    const secret=core.field(req.data?.secret,300,'Secret',true);
    if(!/^[A-Za-z0-9_-]{3,100}$/.test(appId)||secret.length<6)throw new Error('App ID ou Secret inválido.');
    // Fail closed: only persist the user's credentials after a signed live API call succeeds.
    await core.callAffiliate({appId,secret,query:core.queryOffers('casa',1,1)});
    await ensure(uid,req.auth.token.name||'');
    await secrets.doc(uid).set({encryptedAppId:core.encrypt(appId,encryptedKey.value()),encryptedSecret:core.encrypt(secret,encryptedKey.value()),updatedAt:admin.firestore.FieldValue.serverTimestamp()});
    return {ok:true,appIdLast4:appId.slice(-4)};
  } catch(e){throw err(e);}
});

exports.disconnectAffiliate=onCall(async req=>{
  try {const uid=uidOf(req);await secrets.doc(uid).delete();return {ok:true};}
  catch(e){throw err(e);}
});

exports.searchOffers=onCall({secrets:[encryptedKey],timeoutSeconds:45},async req=>{
  try{
    const uid=uidOf(req);
    const creds=await getCredentials(uid);
    if(!creds)throw new Error('Conecte a API de Afiliados Shopee em Configurações para pesquisar ofertas.');
    const keyword=core.field(req.data?.keyword,80,'termo de busca',true);
    if(keyword.length<2)throw new Error('Digite pelo menos duas letras para buscar.');
    const page=Math.min(5,Math.max(1,Number(req.data?.page)||1));
    const result=await core.callAffiliate({...creds,query:core.queryOffers(keyword,page,16)});
    const offers=(result.productOfferV2?.nodes||[]).flatMap(raw=>{try{return [core.mapOffer(raw)];}catch{return [];}});
    return {offers,page,hasNextPage:!!result.productOfferV2?.pageInfo?.hasNextPage};
  }catch(e){throw err(e);}
});

exports.publishProduct=onCall({secrets:[encryptedKey],timeoutSeconds:45},async req=>{
  try{
    const uid=uidOf(req);
    const info=req.data||{};
    const name=core.field(info.name,180,'nome do produto',true);
    const description=core.field(info.description,350,'descrição');
    const category=core.category(info.category);
    const originalUrl=core.shopeeUrl(info.originalUrl);
    const image=core.imageUrl(info.image);
    const price=core.currencyValue(info.price);
    const creds=await getCredentials(uid);
    let affiliateUrl,trackingSource;
    if(creds){
      const query=core.queryShortLink(originalUrl,['shopeepanel',uid.slice(0,12)]);
      const result=await core.callAffiliate({...creds,query});
      affiliateUrl=core.shopeeUrl(result.generateShortLink?.shortLink);
      trackingSource='api';
    } else {
      if(!info.affiliateUrl)throw new Error('Conecte a API para gerar o link automaticamente ou informe o link de afiliado já criado na Shopee.');
      affiliateUrl=core.shopeeUrl(info.affiliateUrl);
      trackingSource='informado-pelo-usuario';
    }
    await ensure(uid,req.auth.token.name||'');
    const ref=shops.doc(uid).collection('products').doc();
    const product={name,description,category,originalUrl,affiliateUrl,image,price,trackingSource,published:true,createdAt:admin.firestore.FieldValue.serverTimestamp()};
    const batch=db.batch();
    batch.set(ref,product);
    batch.update(shops.doc(uid),{productCount:admin.firestore.FieldValue.increment(1),updatedAt:admin.firestore.FieldValue.serverTimestamp()});
    await batch.commit();
    return {ok:true,id:ref.id,affiliateUrl,trackingSource};
  }catch(e){throw err(e);}
});

exports.removeProduct=onCall(async req=>{
  try{
    const uid=uidOf(req); const id=String(req.data?.id||'');
    if(!/^[A-Za-z0-9_-]{10,60}$/.test(id))throw new Error('Identificador do produto inválido.');
    const ref=shops.doc(uid).collection('products').doc(id);
    await db.runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(!snap.exists)throw new HttpsError('not-found','Produto não encontrado.');
      tx.delete(ref);
      tx.update(shops.doc(uid),{productCount:admin.firestore.FieldValue.increment(-1),updatedAt:admin.firestore.FieldValue.serverTimestamp()});
    });
    return {ok:true};
  }catch(e){throw err(e);}
});

exports.getReport=onCall({secrets:[encryptedKey],timeoutSeconds:110},async req=>{
  try{
    const uid=uidOf(req);
    const creds=await getCredentials(uid);
    if(!creds)return {connected:false,summary:null};
    const days=[7,30].includes(Number(req.data?.days))?Number(req.data.days):30;
    const to=Math.floor(Date.now()/1000),from=to-days*86400;
    const nodes=[];let scrollId='',partial=false;
    for(let i=0;i<4;i++){
      const result=await core.callAffiliate({...creds,query:core.queryReport(from,to,scrollId)});
      const report=result.conversionReport||{};
      nodes.push(...(report.nodes||[]));
      const more=!!report.pageInfo?.hasNextPage;
      if(!more)break;
      scrollId=String(report.pageInfo.scrollId||'');
      if(!scrollId || i===3){partial=true;break;}
    }
    return {connected:true,days,summary:core.summarizeConversions(nodes,partial,uid.slice(0,12)),consultedAt:Date.now()};
  }catch(e){throw err(e);}
});