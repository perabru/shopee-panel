'use strict';
const crypto=require('node:crypto');
const {onCall,onRequest,HttpsError}=require('firebase-functions/v2/https');
const {defineSecret}=require('firebase-functions/params');
const admin=require('firebase-admin');
const core=require('./shopee-core');
admin.initializeApp();
const db=admin.firestore();
const REGION='southamerica-east1';
const FRONTEND_URL='https://perabru.github.io/shopee-panel/';
const SHOPEE_PARTNER_ID=defineSecret('SHOPEE_PARTNER_ID');
const SHOPEE_PARTNER_KEY=defineSecret('SHOPEE_PARTNER_KEY');
const SHOPEE_TOKEN_CIPHER_KEY=defineSecret('SHOPEE_TOKEN_CIPHER_KEY');
const SECRETS=[SHOPEE_PARTNER_ID,SHOPEE_PARTNER_KEY,SHOPEE_TOKEN_CIPHER_KEY];
const opts={region:REGION,secrets:SECRETS,maxInstances:12,timeoutSeconds:90,memory:'512MiB'};
const authStates=db.collection('shopeeStudioAuthStates');
const shopsCollection=uid=>db.collection('shopeeStudioUsers').doc(uid).collection('shops');
const draftsCollection=uid=>db.collection('shopeeStudioUsers').doc(uid).collection('drafts');
const partnerId=()=>{const id=SHOPEE_PARTNER_ID.value();if(!/^\d+$/.test(id||''))throw new HttpsError('failed-precondition','O Partner ID da Shopee não foi configurado.');return id};
const partnerKey=()=>{const key=SHOPEE_PARTNER_KEY.value();if(!key)throw new HttpsError('failed-precondition','A chave Shopee Partner Key não está configurada.');return key};
const cipherKey=()=>{const key=SHOPEE_TOKEN_CIPHER_KEY.value();if(!/^[0-9a-f]{64}$/i.test(key||''))throw new HttpsError('failed-precondition','Chave de criptografia de tokens não configurada.');return key};
const authUid=req=>{if(!req.auth?.uid)throw new HttpsError('unauthenticated','Faça login no Firebase para continuar.');return req.auth.uid};
const validateShopId=val=>{const s=String(val||'');if(!/^\d{1,20}$/.test(s))throw new HttpsError('invalid-argument','ID de loja inválido.');return s};
const reject=message=>new HttpsError('failed-precondition',String(message).slice(0,220));
const shopeeHost=core.API_HOSTS.BRAZIL;
function callbackUrl(){const project=process.env.GCLOUD_PROJECT||process.env.GCP_PROJECT||'gahepatama-4707c';return `https://${REGION}-${project}.cloudfunctions.net/shopeeCallback`}
const hop = (uri,body=null)=>body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{method:'GET'};

async function requestShopee(path,{params={},body=null,method=null,accessToken,shopId}={}){
  const isShop=accessToken!==undefined;
  const url=core.signedEndpoint({host:shopeeHost,partnerId:partnerId(),partnerKey:partnerKey(),path,accessToken:isShop?accessToken:undefined,shopId:isShop?shopId:undefined,params});
  const init={method:method||(body?'POST':'GET'),headers:{Accept:'application/json'},signal:AbortSignal.timeout(20000)};
  if(body){init.headers['Content-Type']='application/json';init.body=JSON.stringify(body)}
  let response;try{response=await fetch(url,init)}catch(e){throw reject('Não foi possível contactar a Shopee. Tente novamente mais tarde.');}
  let json;try{json=await response.json()}catch{throw reject(`Resposta da Shopee inválida (${response.status}).`)}
  if(!response.ok||json?.error){throw reject(`Shopee: ${String(json?.error||response.status).slice(0,75)} — ${String(json?.message||json?.msg||'Verifique as permissões do aplicativo.').slice(0,130)}`)}
  return json;
}
async function exchangeCode(code,shopId){const data=await requestShopee('/api/v2/auth/token/get',{method:'POST',body:{code,shop_id:Number(shopId),partner_id:Number(partnerId())}});
  const t=data.response||data;if(!t.access_token||!t.refresh_token)throw reject('A Shopee não retornou os tokens necessários.');
  return {access_token:t.access_token,refresh_token:t.refresh_token,expires_at:Date.now()+(Number(t.expire_in||t.expires_in)||14400)*1000,refresh_expires_at:Date.now()+30*24*3600*1000};
}
async function freshToken(uid,shopId){const ref=shopsCollection(uid).doc(shopId),snap=await ref.get();if(!snap.exists)throw new HttpsError('permission-denied','Esta loja não foi autorizada pela sua conta.');
  let tokens;try{tokens=core.decryptToken(snap.get('encryptedTokens'),cipherKey())}catch(e){throw reject('Não foi possível ler os tokens da loja. Reconecte na Shopee.');}
  if(tokens.expires_at>Date.now()+180000)return {tokens,shop:snap.data()};
  if(tokens.refresh_expires_at && tokens.refresh_expires_at<Date.now())throw reject('Autorização vencida. Conecte a loja novamente.');
  const data=await requestShopee('/api/v2/auth/access_token/get',{method:'POST',body:{refresh_token:tokens.refresh_token,shop_id:Number(shopId),partner_id:Number(partnerId())}});
  const t=data.response||data;if(!t.access_token||!t.refresh_token)throw reject('Não foi possível atualizar o token. Reautorize a loja.');
  tokens={access_token:t.access_token,refresh_token:t.refresh_token,expires_at:Date.now()+(Number(t.expire_in||t.expires_in)||14400)*1000,refresh_expires_at:Date.now()+30*24*3600*1000};
  await ref.update({encryptedTokens:core.encryptToken(tokens,cipherKey()),tokenUpdatedAt:admin.firestore.FieldValue.serverTimestamp()});
  return {tokens,shop:snap.data()};
}
async function withShop(uid,shopId,fn){const id=validateShopId(shopId),{tokens}=await freshToken(uid,id);return fn((path,opts={})=>requestShopee(path,{...opts,accessToken:tokens.access_token,shopId:id}));}
function apiWarning(error){return String(error?.message||'API indisponível').slice(0,160).replace(/\b[a-f0-9]{40,}\b/gi,'[redigido]')}

exports.getSession=onCall(opts,async req=>{const uid=authUid(req),snapshot=await shopsCollection(uid).limit(50).get();
  return {shops:snapshot.docs.map(d=>({shopId:d.id,shopName:d.get('shopName')||'Loja '+d.id,region:d.get('region')||'BR',authorizedAt:d.get('authorizedAt')?.toMillis?.()||null}))};
});
exports.startShopeeAuth=onCall(opts,async req=>{const uid=authUid(req);
  const nonce=crypto.randomBytes(32).toString('hex');await authStates.doc(nonce).set({uid,expiresAt:Date.now()+10*60*1000,createdAt:admin.firestore.FieldValue.serverTimestamp()});
  return {url:core.makeAuthorizationUrl({partnerId:partnerId(),redirectUrl:callbackUrl(),state:nonce,region:'BRAZIL'})};
});
exports.shopeeCallback=onRequest({region:REGION,secrets:SECRETS,timeoutSeconds:90,memory:'512MiB',invoker:'public'},async(req,res)=>{
  res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');res.set('X-Content-Type-Options','nosniff');
  if(req.method!=='GET'){res.status(405).send('Método não permitido');return;}
  const code=typeof req.query.code==='string'?req.query.code:'', shopId=typeof req.query.shop_id==='string'?req.query.shop_id:'',state=typeof req.query.state==='string'?req.query.state:'';
  if(!/^[a-f0-9]{64}$/.test(state)){res.redirect(303,FRONTEND_URL+'?oauth_error=state');return;}
  let uid;try{
    uid=await db.runTransaction(async t=>{const ref=authStates.doc(state),snap=await t.get(ref);if(!snap.exists||snap.get('expiresAt')<Date.now())throw Error('Autorização expirada');t.delete(ref);return snap.get('uid')});
  }catch(e){res.redirect(303,FRONTEND_URL+'?oauth_error=expired');return;}
  if(!/^[a-zA-Z0-9_-]{4,200}$/.test(code)||!/^\d{1,20}$/.test(shopId)){res.redirect(303,FRONTEND_URL+'?oauth_error=cancelled');return;}
  try{
    const tokens=await exchangeCode(code,shopId);let shopName='Loja '+shopId,region='BR';
    try{const info=await requestShopee('/api/v2/shop/get_shop_info',{accessToken:tokens.access_token,shopId});const s=info.response||{};shopName=String(s.shop_name||shopName).slice(0,120);region=String(s.region||region).slice(0,12);}catch(e){/* Seller information is optional; token still belongs to the authorized shop. */}
    await shopsCollection(uid).doc(shopId).set({shopName,region,encryptedTokens:core.encryptToken(tokens,cipherKey()),authorizedAt:admin.firestore.FieldValue.serverTimestamp()});
    res.redirect(303,FRONTEND_URL+'?connected=1#integracoes');
  }catch(e){console.error('Shopee OAuth exchange failed:',apiWarning(e));res.redirect(303,FRONTEND_URL+'?oauth_error=exchange');}
});

async function loadOrders(shopee){const to=Math.floor(Date.now()/1000),from=to-14*86400;let arr=[],cursor='',lastCursor=null,partial=false;
  for(let page=0;page<4;page++){
    const data=await shopee('/api/v2/order/get_order_list',{params:{time_range_field:'create_time',time_from:from,time_to:to,page_size:50,cursor}});
    const result=data.response||{},rows=Array.isArray(result.order_list)?result.order_list:[];arr.push(...rows);
    if(!result.more||!result.next_cursor||result.next_cursor===lastCursor)break;
    lastCursor=cursor;cursor=String(result.next_cursor);if(page===3)partial=true;
  }
  const refs=[...new Set(arr.map(o=>o.order_sn).filter(Boolean))];const amounts=new Map();
  for(let j=0;j<refs.length;j+=50){
    try{const detail=await shopee('/api/v2/order/get_order_detail',{params:{order_sn_list:refs.slice(j,j+50).join(','),response_optional_fields:'total_amount'}});
      for(const entry of detail.response?.order_list||[]){amounts.set(entry.order_sn,entry)}
    }catch(e){/* Order data still renders without values when permission is missing. */}
  }
  return {orders:core.normalizeOrders(arr.map(o=>({...o,...(amounts.get(o.order_sn)||{})}))),partial};
}
async function loadProducts(shopee){let results=[],warnings=[];
  for(const itemStatus of ['NORMAL','UNLIST']){
    try{let cursor=0;for(let p=0;p<2;p++){
      const data=await shopee('/api/v2/product/get_item_list',{params:{offset:cursor,page_size:50,item_status:itemStatus}}),r=data.response||{};
      results.push(...(r.item||r.item_list||[]));if(!r.has_next_page)break;cursor=Number(r.next_offset);if(!Number.isFinite(cursor))break;
    }}catch(e){warnings.push('Produtos '+itemStatus+': '+apiWarning(e));}
  }
  const distinct=[...new Map(results.filter(x=>x.item_id).map(x=>[String(x.item_id),x])).values()];
  const details=new Map();
  for(let i=0;i<distinct.length;i+=50){try{const ids=distinct.slice(i,i+50).map(x=>x.item_id);
    const data=await shopee('/api/v2/product/get_item_base_info',{params:{item_id_list:ids.join(',')}});
    for(const product of data.response?.item_list||[])details.set(String(product.item_id),product);
  }catch(e){warnings.push('Detalhes de produtos: '+apiWarning(e));}}
  return {products:distinct.map(p=>core.normalizeProduct({...p,...(details.get(String(p.item_id))||{})})),warnings};
}
async function loadIncome(shopee){const result=await shopee('/api/v2/payment/get_income_overview');return core.normalizeIncomeOverview(result)}
exports.getDashboard=onCall(opts,async req=>{const uid=authUid(req),shopId=validateShopId(req.data?.shopId);
  return withShop(uid,shopId,async shopee=>{
    const [ordersResult,productsResult,financeResult]=await Promise.allSettled([loadOrders(shopee),loadProducts(shopee),loadIncome(shopee)]);
    const warnings=[];let orders=[],products=[],finance=null,financeError='';
    if(ordersResult.status==='fulfilled'){orders=ordersResult.value.orders;if(ordersResult.value.partial)warnings.push('Mais de 200 pedidos; exibindo apenas as primeiras páginas.');}
    else warnings.push('Pedidos: '+apiWarning(ordersResult.reason));
    if(productsResult.status==='fulfilled'){products=productsResult.value.products;warnings.push(...productsResult.value.warnings)}
    else warnings.push('Produtos: '+apiWarning(productsResult.reason));
    if(financeResult.status==='fulfilled')finance=financeResult.value;
    else financeError='Consulta financeira indisponível: '+apiWarning(financeResult.reason);
    return {orders,products,finance,financeError,warnings};
  });
});
exports.getPublishOptions=onCall(opts,async req=>{const uid=authUid(req),shopId=validateShopId(req.data?.shopId);
  return withShop(uid,shopId,async shopee=>{
    const [c,l]=await Promise.all([shopee('/api/v2/product/get_category'),shopee('/api/v2/logistics/get_channel_list')]);
    return {categories:(c.response?.category_list||[]).map(x=>({id:String(x.category_id),name:String(x.display_category_name||x.category_name||'Categoria '+x.category_id),has_children:Boolean(x.has_children??x.has_child??false),parent_id:x.parent_category_id||null})),
      logistics:(l.response?.logistics_channel_list||[]).map(x=>({id:String(x.logistics_channel_id||x.logistic_id||''),name:String(x.logistics_channel_name||x.logistic_name||'Entrega'),enabled:x.enabled!==false,fee_type:String(x.fee_type||''),sizes:x.size_list||[]})).filter(x=>/^\d+$/.test(x.id))};
  });
});
exports.uploadShopeeImage=onCall({...opts,memory:'1GiB'},async req=>{const uid=authUid(req),shopId=validateShopId(req.data?.shopId);
  const {mimeType,base64,fileName}=req.data||{};
  if(!['image/png','image/jpeg','image/webp'].includes(mimeType)||typeof base64!=='string'||base64.length>7.1e6)throw new HttpsError('invalid-argument','Imagem inválida ou maior que 5 MB.');
  const content=Buffer.from(base64,'base64');if(!content.length||content.length>5*1024*1024)throw new HttpsError('invalid-argument','Arquivo de imagem inválido.');
  const isJpg=content[0]===255&&content[1]===216&&content[2]===255,isPng=content.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),isWebp=content.toString('ascii',0,4)==='RIFF'&&content.toString('ascii',8,12)==='WEBP';
  if(!((mimeType==='image/jpeg'&&isJpg)||(mimeType==='image/png'&&isPng)||(mimeType==='image/webp'&&isWebp)))throw new HttpsError('invalid-argument','Formato real do arquivo não coincide com seu tipo.');
  return withShop(uid,shopId,async shopee=>{
    // Upload is multipart/form-data; never expose signed URL or token to the browser.
    const {tokens}=await freshToken(uid,shopId);const path='/api/v2/media_space/upload_image';
    const url=core.signedEndpoint({host:shopeeHost,partnerId:partnerId(),partnerKey:partnerKey(),path,accessToken:tokens.access_token,shopId});
    const form=new FormData();const ext=mimeType==='image/png'?'png':mimeType==='image/webp'?'webp':'jpg';
    const name=(String(fileName||'imagem').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,75)||'imagem')+'.'+ext;
    form.append('image',new Blob([content],{type:mimeType}),name);
    let response;try{response=await fetch(url,{method:'POST',body:form,signal:AbortSignal.timeout(30000)})}catch{throw reject('Falha de rede durante o envio da imagem à Shopee.');}
    let data;try{data=await response.json()}catch{throw reject('Resposta inesperada da API de imagens da Shopee.');}
    if(!response.ok||data.error)throw reject('Shopee: '+String(data.message||data.error||'Falha no upload da imagem').slice(0,160));
    const image_id=data.response?.image_info?.image_id||data.response?.image_id||data.response?.image_info_list?.[0]?.image_id;
    if(!image_id)throw reject('A API não retornou o ID da imagem enviada.');return {image_id:String(image_id)};
  });
});
exports.publishProduct=onCall(opts,async req=>{const uid=authUid(req),shopId=validateShopId(req.data?.shopId);
  let product;try{product=core.validateProduct(req.data?.product)}catch(e){throw new HttpsError('invalid-argument',e.message)}
  return withShop(uid,shopId,async shopee=>{
    const data=await shopee('/api/v2/product/add_item',{method:'POST',body:product});const id=data.response?.item_id;
    if(!id)throw reject('Shopee aceitou a requisição, mas não retornou o ID do item. Confira a Central do Vendedor antes de tentar novamente.');
    return {item_id:String(id),status:product.item_status,product_url:`https://shopee.com.br/product/${shopId}/${id}`};
  });
});
exports.getIncomeDetails=onCall(opts,async req=>{const uid=authUid(req),shopId=validateShopId(req.data?.shopId);
  return withShop(uid,shopId,async shopee=>{
    const to=new Date(),from=new Date(Date.now()-13*86400000);const fmt=d=>d.toISOString().slice(0,10);
    const rows=[];for(const [status,label] of [[2,'pending'],[1,'released']]){
      try{const result=await shopee('/api/v2/payment/get_income_detail',{params:{income_status:status,...(status===1?{date_from:fmt(from),date_to:fmt(to)}:{}),page_size:50}});
        for(const entry of result.response?.list||[]){const amount=status===2?entry.estimated_escrow_amount:entry.released_amount;rows.push({order_sn:String(entry.order_sn||''),income_status:label,amount:Number.isFinite(Number(amount))?Number(amount):null,payout_time:Number(entry.actual_payout_time)||null});}
      }catch(e){/* The overview is still shown if this advanced endpoint isn't authorized. */}
    }return {records:rows};
  });
});
exports.saveProductDraft=onCall(opts,async req=>{const uid=authUid(req),values=req.data?.values;
  if(!values||typeof values!=='object'||Array.isArray(values)||JSON.stringify(values).length>10000)throw new HttpsError('invalid-argument','Dados de rascunho inválidos.');
  const d=Object.fromEntries(Object.entries(values).filter(([key,v])=>/^(itemName|description|categoryId|sku|condition|ncm|originalPrice|stock|weight|pkgLength|pkgWidth|pkgHeight|attributesJson|brandId|brandName|publishNow|logistics)$/.test(key)).map(([key,value])=>[key,Array.isArray(value)?value.slice(0,30).map(x=>String(x).slice(0,100)):typeof value==='boolean'?value:String(value).slice(0,3500)]));
  const list=draftsCollection(uid),existing=await list.limit(30).get();if(existing.size>=30)throw reject('Limite de 30 rascunhos atingido. Exclua algum antes de continuar.');
  const doc=await list.add({title:String(d.itemName||'Sem título').slice(0,120),shopId:req.data?.shopId?validateShopId(req.data.shopId):null,values:d,updatedAt:Date.now()});return {id:doc.id};
});
exports.listProductDrafts=onCall(opts,async req=>{const uid=authUid(req);const docs=await draftsCollection(uid).orderBy('updatedAt','desc').limit(30).get();return {drafts:docs.docs.map(d=>({id:d.id,title:d.get('title'),values:d.get('values'),updatedAt:d.get('updatedAt')}))}});
exports.deleteProductDraft=onCall(opts,async req=>{const uid=authUid(req),id=String(req.data?.draftId||'');if(!/^[a-zA-Z0-9]{1,30}$/.test(id))throw new HttpsError('invalid-argument','ID de rascunho inválido.');await draftsCollection(uid).doc(id).delete();return {ok:true}});
exports.disconnectShop=onCall(opts,async req=>{const uid=authUid(req),id=validateShopId(req.data?.shopId);await shopsCollection(uid).doc(id).delete();return {ok:true};});