'use strict';
const crypto=require('node:crypto');
const API_HOSTS={BRAZIL:'https://openplatform.shopee.com.br',GLOBAL:'https://partner.shopeemobile.com',SANDBOX:'https://openplatform.sandbox.test-stable.shopee.sg'};
const AUTH_HOSTS={BRAZIL:'https://open.shopee.com.br/auth',GLOBAL:'https://open.shopee.com/auth',SANDBOX:'https://open.test-stable.shopee.com/auth'};

/** Uses official 2024+ Shopee auth URL (state returned on callback), no partner key exposed. */
function makeAuthorizationUrl({partnerId,redirectUrl,state,region='BRAZIL'}){
  if(!/^\d+$/.test(String(partnerId)))throw Error('Partner ID inválido');
  if(!/^[a-f0-9]{48,128}$/.test(state))throw Error('Estado OAuth inválido');
  const url=new URL(AUTH_HOSTS[region]||AUTH_HOSTS.BRAZIL);
  url.searchParams.set('partner_id',String(partnerId));url.searchParams.set('auth_type','seller');
  url.searchParams.set('redirect_uri',redirectUrl);url.searchParams.set('response_type','code');url.searchParams.set('state',state);
  return url.toString();
}
function signShopee({partnerId,partnerKey,path,timestamp,accessToken,shopId}){
  if(!/^\/api\/v2\/[a-z_]+\/[a-z_]+$/.test(path))throw Error('Caminho Shopee inválido');
  const base=`${partnerId}${path}${timestamp}`+(accessToken===undefined?'':`${accessToken}${shopId}`);
  return crypto.createHmac('sha256',partnerKey).update(base).digest('hex');
}
function signedEndpoint({host,partnerId,partnerKey,path,accessToken,shopId,params={}}){
  const ts=Math.floor(Date.now()/1000);const url=new URL(path,host);
  url.searchParams.set('partner_id',String(partnerId));url.searchParams.set('timestamp',String(ts));
  url.searchParams.set('sign',signShopee({partnerId,partnerKey,path,timestamp:ts,accessToken,shopId}));
  if(accessToken!==undefined){url.searchParams.set('access_token',accessToken);url.searchParams.set('shop_id',String(shopId));}
  for(const [key,value] of Object.entries(params)){if(value!==undefined&&value!==null)url.searchParams.set(key,String(value));}
  return url.toString();
}
function encryptToken(data,secretHex){const key=Buffer.from(secretHex||'','hex');if(key.length!==32)throw Error('SHOPEE_TOKEN_CIPHER_KEY deve ter 32 bytes hexadecimais.');
  const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  const buf=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final()]);const tag=cipher.getAuthTag();
  return [iv,tag,buf].map(b=>b.toString('base64url')).join('.');
}
function decryptToken(record,secretHex){const key=Buffer.from(secretHex||'','hex');if(key.length!==32)throw Error('Chave de criptografia não configurada.');
  const parts=String(record).split('.');if(parts.length!==3)throw Error('Registro de token inválido.');const [iv,tag,ciphertext]=parts.map(s=>Buffer.from(s,'base64url'));
  const decipher=crypto.createDecipheriv('aes-256-gcm',key,iv);decipher.setAuthTag(tag);return JSON.parse(Buffer.concat([decipher.update(ciphertext),decipher.final()]).toString('utf8'));
}
function normalizeIncomeOverview(result){const obj=result?.response?.total_income||result?.total_income||result?.response||{};
  const value=(key)=>obj[key]==null||!Number.isFinite(Number(obj[key]))?null:Number(obj[key]);
  return {pending_amount:value('pending_amount'),released_amount:value('released_amount'),to_release_amount:value('to_release_amount')};
}
function normalizeOrders(list){return (Array.isArray(list)?list:[]).map(o=>({order_sn:String(o.order_sn||''),order_status:String(o.order_status||''),create_time:Number(o.create_time)||null,total_amount:Number.isFinite(Number(o.total_amount))&&o.total_amount!=null?Number(o.total_amount):null})).filter(o=>o.order_sn);}
function normalizeProduct(p){const priceObj=p.price_info?.[0]||{};const price=p.original_price??priceObj.current_price??priceObj.original_price??p.price??null;
  const stockObj=p.stock_info_v2?.summary_info||p.stock_info?.[0]||{};
  const stock=p.stock??stockObj.total_available_stock??stockObj.total_seller_stock??null;
  return {item_id:String(p.item_id||''),item_name:String(p.item_name||''),item_status:String(p.item_status||'UNLIST'),price:price!=null&&Number.isFinite(Number(price))?Number(price):null,stock:stock!=null&&Number.isFinite(Number(stock))?Number(stock):null,image_url:p.image?.image_url_list?.[0]||p.image_url||''};
}
function validateProduct(p){if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Produto inválido');
  const name=String(p.item_name||'').trim(),desc=String(p.description||'').trim();
  if(name.length<4||name.length>120)throw Error('O título precisa ter entre 4 e 120 caracteres.');
  if(desc.length<10||desc.length>3000)throw Error('A descrição precisa ter entre 10 e 3000 caracteres.');
  const n=(v,min,max,name,integer=false)=>{const x=Number(v);if(!Number.isFinite(x)||x<min||x>max||(integer&&!Number.isInteger(x)))throw Error(`Campo ${name} fora dos limites permitidos.`);return x};
  const images=p.image?.image_id_list;if(!Array.isArray(images)||!images.length||images.length>9||images.some(x=>typeof x!=='string'||!/^[-_a-zA-Z0-9:]{5,200}$/.test(x)))throw Error('Envie imagens válidas à Shopee antes de publicar.');
  if(!Array.isArray(p.logistic_info)||!p.logistic_info.length||p.logistic_info.length>30)throw Error('Escolha pelo menos uma logística habilitada.');
  const logistics=p.logistic_info.map(x=>({logistic_id:n(x.logistic_id,1,100000000,'logistic_id',true),enabled:true,...(x.size_id?{size_id:n(x.size_id,1,100000000,'size_id',true)}:{})}));
  const body={item_name:name,description:desc,category_id:n(p.category_id,1,99999999999,'categoria',true),original_price:n(p.original_price,0.01,100000000,'preço'),weight:n(p.weight,0.001,1000,'peso'),condition:['NEW','USED'].includes(p.condition)?p.condition:'NEW',item_status:p.item_status==='NORMAL'?'NORMAL':'UNLIST',image:{image_id_list:images},seller_stock:[{stock:n(p.seller_stock?.[0]?.stock,0,999999,'estoque',true)}],dimension:{package_length:n(p.dimension?.package_length,1,500,'comprimento',true),package_width:n(p.dimension?.package_width,1,500,'largura',true),package_height:n(p.dimension?.package_height,1,500,'altura',true)},logistic_info:logistics,pre_order:{is_pre_order:false}};
  if(p.item_sku)body.item_sku=String(p.item_sku).slice(0,50);
  if(p.tax_info?.ncm){const code=String(p.tax_info.ncm);if(!/^(\d{8}|00)$/.test(code))throw Error('NCM precisa ter 8 dígitos ou 00.');body.tax_info={ncm:code};}
  if(p.brand?.brand_id!==undefined){body.brand={brand_id:n(p.brand.brand_id,0,1000000000,'marca',true),original_brand_name:String(p.brand.original_brand_name||'Sem marca').slice(0,100)}}
  if(p.attribute_list!==undefined){if(!Array.isArray(p.attribute_list)||p.attribute_list.length>50)throw Error('Atributos inválidos.');
    body.attribute_list=p.attribute_list.map(a=>({attribute_id:n(a.attribute_id,1,1000000000,'attribute_id',true),attribute_value_list:(Array.isArray(a.attribute_value_list)?a.attribute_value_list:[]).slice(0,30).map(v=>({value_id:n(v.value_id,0,1000000000,'value_id',true),...(v.original_value_name?{original_value_name:String(v.original_value_name).slice(0,255)}:{}),...(v.value_unit?{value_unit:String(v.value_unit).slice(0,40)}:{})}))}));}
  return body;
}
module.exports={API_HOSTS,AUTH_HOSTS,makeAuthorizationUrl,signShopee,signedEndpoint,encryptToken,decryptToken,normalizeIncomeOverview,normalizeOrders,normalizeProduct,validateProduct};