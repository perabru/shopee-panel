'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const tools = require('../product-tools');
const link = 'https://s.shopee.com.br/aBc123?share_channel_code=1&uls_trackid=X%2FY#offer';
const goodPayload = {status:'success',data:{title:'Fone Bluetooth Pro | Shopee Brasil',url:'https://shopee.com.br/product/123/456',image:{url:'https://down-br.img.susercontent.com/file/photo1'},images:[{url:'https://down-br.img.susercontent.com/file/photo1'},{url:'https://down-br.img.susercontent.com/file/photo2'},'javascript:alert(1)']}};
const response = (body = goodPayload,status = 200) => ({ok:status >= 200 && status < 300,status,json:async()=>body});

test('extracts the original affiliate URL from a full shared message or Markdown',()=>{
 assert.equal(tools.extractShopeeLink(`Olha este produto por R$ 129,90! Confira: ${link}\nAproveite hoje.`),link);
 assert.equal(tools.extractShopeeLink(`[Compre aqui](${link})`),link);
 assert.equal(tools.extractShopeeLink(`Produto (https://shopee.com.br/product/123/456).`),'https://shopee.com.br/product/123/456');
 assert.equal(tools.extractShopeeLink(`  ${link}  `),link);
 assert.equal(tools.extractShopeeLink('https://shopee.com.br/product/1/2?token=end.'),'https://shopee.com.br/product/1/2?token=end.');
});

test('rejects lookalike hosts, unsafe schemes, credentials, embedded whitespace and oversized links',()=>{
 for (const value of ['https://shopee.com.br.evil.example/product','https://evilshopee.com.br/product','http://shopee.com.br/product','https://user:secret@shopee.com.br/product','https://shopee.com.br/hello world','https://shopee.com.br/\\evil','https://shopee.com.br/'+ 'a'.repeat(1200)]) assert.equal(tools.validShopee(value),false,value);
 assert.equal(tools.extractShopeeLink('Oferta https://evil.example/produto e https://shope.ee/abc'),'https://shope.ee/abc');
 assert.equal(tools.extractShopeeLink('nenhum link aqui'),'');
});

test('accepts Brazilian money without silently converting malformed input to a different price',()=>{
 for (const [input,expected] of [['R$ 1.299,90',1299.9],['129,90',129.9],['1299.90',1299.9],['1.299',1299],['129',129],[0,0],['0,00',0],['',null],[null,null]]) assert.equal(tools.parsePrice(input),expected);
 for (const input of ['1,2,3','1.2.3','R$ -12','Infinity','1e5','R$','12 reais','1,000.00',-1,1e9]) assert.throws(()=>tools.parsePrice(input),/Preço inválido/);
});

test('returns distinct safe photos and strips only the Shopee suffix from product titles',()=>{
 const result = tools.parsePreview(goodPayload);
 assert.equal(result.name,'Fone Bluetooth Pro');
 assert.equal(result.image,goodPayload.data.image.url);
 assert.equal(result.images.length,2);
 assert.equal(result.resolvedUrl,goodPayload.data.url);
 assert.equal(tools.safeImage('https://name:secret@cdn.example/photo.jpg'),'');
 assert.equal(tools.safeImage('data:image/svg+xml;base64,abc'),'');
 assert.throws(()=>tools.parsePreview({status:'success',data:{title:'Just a moment...',image:{url:'https://cdn.example/challenge.png'}}}),/não liberou/);
 assert.throws(()=>tools.parsePreview({status:'success',data:{title:'Fone',url:'https://evil.example',image:{url:'https://cdn.example/a.jpg'}}}),/redirecionou/);
 assert.throws(()=>tools.parsePreview({status:'success',data:{title:'Shopee Brasil'}}),/não informou/);
});

test('preserves affiliate URL sent to preview service, caches successes and supports real retry',async()=>{
 const calls=[];
 const lookup=tools.createPreviewLookup({fetch:async (url,options)=>{calls.push({url,options});return response();}});
 const first=await lookup(link);
 assert.equal(new URL(calls[0].url).searchParams.get('url'),link);
 assert.equal(calls[0].options.referrerPolicy,'no-referrer');
 assert.equal(calls[0].options.headers.Accept,'application/json');
 first.images.push('bad');
 assert.equal((await lookup(link)).images.length,2,'callers cannot mutate the cached gallery');
 assert.equal(calls.length,1);
 await lookup(link,{force:true});
 assert.equal(calls.length,2);
 lookup.clear(link);
 await lookup(link);
 assert.equal(calls.length,3);
});

test('deduplicates simultaneous requests without caching failures',async()=>{
 let release;
 let calls=0;
 const lookup=tools.createPreviewLookup({fetch:async()=>{calls++;return new Promise(resolve=>{release=resolve;});}});
 const a=lookup(link),b=lookup(link);
 assert.equal(calls,1);
 release(response());
 await Promise.all([a,b]);
 let failCalls=0;
 const retry=tools.createPreviewLookup({fetch:async()=>{failCalls++;return response({status:'fail'},200);}});
 await assert.rejects(retry(link),/não liberou/);
 await assert.rejects(retry(link),/não liberou/);
 assert.equal(failCalls,2);
});

test('expires cached metadata and does not request arbitrary URLs',async()=>{
 let now=0,calls=0;
 const lookup=tools.createPreviewLookup({cacheTtlMs:10,now:()=>now,fetch:async()=>{calls++;return response();}});
 await lookup(link);
 now=11;
 await lookup(link);
 assert.equal(calls,2);
 await assert.rejects(lookup('https://evil.example'),/Shopee/);
 assert.equal(calls,2);
});

test('times out even a stalled response and exposes actionable limit and network failures',async()=>{
 let capturedSignal;
 const lookup=tools.createPreviewLookup({timeoutMs:5,fetch:async (_,options)=>{capturedSignal=options.signal;return new Promise(()=>{});}});
 await assert.rejects(lookup(link),error=>error.code==='PREVIEW_TIMEOUT');
 assert.equal(capturedSignal.aborted,true);
 const limited=tools.createPreviewLookup({fetch:async()=>response({},429)});
 await assert.rejects(limited(link),error=>error.code==='PREVIEW_LIMIT');
 const network=tools.createPreviewLookup({fetch:async()=>{throw new TypeError('fetch failed');}});
 await assert.rejects(network(link),error=>error.code==='PREVIEW_NETWORK');
});


test('recognizes explicit Shopee shared product copy without changing its affiliate URL',()=>{
 assert.deepEqual(tools.parseSharedProduct(`Confira Fone Bluetooth por R$129,90. Compre na Shopee agora! ${link}`),{url:link,name:'Fone Bluetooth',price:129.9});
 assert.deepEqual(tools.parseSharedProduct(`Confira Cafeteira Elétrica por apenas R$ 1.299,90. ${link}`),{url:link,name:'Cafeteira Elétrica',price:1299.9});
 assert.deepEqual(tools.parseSharedProduct(`Confira Mouse sem fio com 30% de desconto! Somente R$29,90. Compre na Shopee agora! ${link}`),{url:link,name:'Mouse sem fio',price:29.9});
});

test('does not invent titles from free-form marketing or generic shared copy',()=>{
 assert.deepEqual(tools.parseSharedProduct(`Oferta imperdível para você R$129,90! ${link}`),{url:link,name:'',price:129.9});
 assert.deepEqual(tools.parseSharedProduct(`Confira esse produto por R$129,90! ${link}`),{url:link,name:'',price:129.9});
 assert.deepEqual(tools.parseSharedProduct(`Confira ofertas incríveis para a família! ${link}`),{url:link,name:'',price:null});
 assert.deepEqual(tools.parseSharedProduct('Confira Fone Bluetooth por R$129,90! https://evil.example'),{url:'',name:'',price:null});
});

test('keeps ambiguous old/new prices, ranges and malformed amounts blank',()=>{
 for (const copy of ['De R$ 150,00 por R$129,90','R$ 10 a 20','R$ 10 até 20','A partir de R$ 10,00','Até R$ 10,00','R$ 1,2,3','R$129,90abc']) {
  assert.equal(tools.parseSharedProduct(`${copy} ${link}`).price,null,copy);
 }
 assert.equal(tools.parseSharedProduct(`Confira Fone Bluetooth por R$129,90. Antes R$159,90. ${link}`).price,null);
});

const canonical='https://shopee.com.br/product/123/456';
const landing='https://shopee.com.br/opaanlp/123/456?__mobile__=1&uls_trackid=X%2FY';
function completeProductPayload(url=canonical){
 return {status:'success',statusCode:200,data:{url,title:'Fone de ouvido',productJsonLd:[JSON.stringify({'@context':'https://schema.org','@graph':[{'@type':'Product',name:'Outro produto',url:'https://shopee.com.br/product/123/999',image:'https://cdn.example/other.jpg',offers:{'@type':'Offer',price:'99.00',priceCurrency:'BRL'}},{'@type':'Product',name:'Fone Bluetooth Pro',url:canonical,description:'<p>Som estéreo &amp; microfone.</p>',image:['https://cdn.example/front.jpg','https://cdn.example/back.jpg'],offers:{'@type':'Offer',price:'129.90',priceCurrency:'BRL',url:canonical}}]})]}};
}

test('imports the full matching JSON-LD product including description, price and gallery',async()=>{
 const calls=[];
 const lookup=tools.createPreviewLookup({fetch:async url=>{calls.push(url);return response(completeProductPayload());}});
 const info=await lookup(link);
 assert.equal(info.name,'Fone Bluetooth Pro');
 assert.equal(info.description,'Som estéreo & microfone.');
 assert.equal(info.price,129.9);
 assert.equal(info.currency,'BRL');
 assert.equal(info.priceSource,'dados estruturados do produto');
 assert.deepEqual(info.images,['https://cdn.example/front.jpg','https://cdn.example/back.jpg']);
 assert.equal(info.image,info.images[0]);
 assert.equal(info.resolvedUrl,canonical);
 assert.equal(info.canonicalUrl,canonical);
 assert.equal(calls.length,1);
 assert.equal(new URL(calls[0]).searchParams.get('url'),link);
});

test('requests rendered product metadata, structured data and explicit currency extraction',async()=>{
 let requested;
 const lookup=tools.createPreviewLookup({fetch:async url=>{requested=new URL(url);return response(completeProductPayload());}});
 await lookup(link);
 assert.equal(requested.origin,'https://api.microlink.io');
 assert.equal(requested.searchParams.get('url'),link);
 assert.equal(requested.searchParams.get('prerender'),'true');
 assert.equal(requested.searchParams.get('data.productJsonLd.selectorAll'),'script[type="application/ld+json"]');
 assert.equal(requested.searchParams.get('data.productJsonLd.attr'),'text');
 assert.equal(requested.searchParams.get('data.pageTitle.selector'),'h1');
 assert.equal(requested.searchParams.get('data.productDescription.selector'),'[itemprop="description"]');
 assert.match(requested.searchParams.get('data.priceMeta.selector'),/product:price:amount/);
 assert.equal(requested.searchParams.get('data.priceMeta.attr'),'content');
 assert.match(requested.searchParams.get('data.currencyMeta.selector'),/product:price:currency/);
 assert.equal(requested.searchParams.get('data.priceText.selector'),'[itemprop="price"]');
});

test('follows an empty opaanlp landing page once and keeps the original affiliate cache key',async()=>{
 const calls=[];
 const lookup=tools.createPreviewLookup({fetch:async url=>{
  const target=new URL(url).searchParams.get('url');calls.push(target);
  return response(target===link?{status:'success',data:{url:landing,title:'456?__mobile__=1&exp_group=a'}}:completeProductPayload());
 }});
 const info=await lookup(link);
 assert.deepEqual(calls,[link,canonical]);
 assert.equal(info.name,'Fone Bluetooth Pro');
 assert.equal(info.price,129.9);
 assert.equal(info.canonicalUrl,canonical);
 await lookup(link);
 assert.deepEqual(calls,[link,canonical],'the original affiliate URL has a successful cached result');
 assert.equal(tools.extractShopeeLink(link),link,'canonical read never rewrites affiliate tracking');
});

test('completes partial opaanlp metadata from canonical product details',async()=>{
 const calls=[];
 const lookup=tools.createPreviewLookup({fetch:async url=>{
  const target=new URL(url).searchParams.get('url');calls.push(target);
  return response(target===link?{status:'success',data:{url:landing,title:'Fone Bluetooth Pro',image:{url:'https://cdn.example/front.jpg'}}}:completeProductPayload());
 }});
 const info=await lookup(link);
 assert.deepEqual(calls,[link,canonical]);
 assert.equal(info.description,'Som estéreo & microfone.');
 assert.equal(info.price,129.9);
});

test('ID-only and tracking-query page titles are never imported as product names',()=>{
 for(const title of ['456','123/456','123.456','456?__mobile__=1&exp_group=a','abc123?utm_source=affiliate','https://shopee.com.br/product/123/456']){
  const info=tools.parsePreview({status:'success',data:{url:canonical,title,image:{url:'https://cdn.example/front.jpg'}}});
  assert.equal(info.name,'',title);
  assert.equal(tools.cleanTitle(title),'',title+' helper');
 }
});

test('verification and denied pages stop the chain without another preview request',async()=>{
 for(const payload of [
  {status:'success',data:{url:'https://shopee.com.br/verify/traffic?shopid=123&itemid=456',title:'Shopee'}},
  {status:'success',data:{url:landing,title:'A verificação falhou. Tente novamente em alguns minutos.'}},
  {status:'success',statusCode:403,data:{url:landing,title:'456'}}
 ]){
  const calls=[];
  const lookup=tools.createPreviewLookup({fetch:async url=>{calls.push(new URL(url).searchParams.get('url'));return response(payload);}});
  await assert.rejects(lookup(link),error=>error.code==='PREVIEW_BLOCKED');
  assert.deepEqual(calls,[link]);
 }
});

test('timeout covers the whole redirect chain and retains canonical identity for API fallback',async()=>{
 const calls=[];let signal;
 const lookup=tools.createPreviewLookup({timeoutMs:20,fetch:async (url,options)=>{
  const target=new URL(url).searchParams.get('url');calls.push(target);signal=options.signal;
  if(target===link){await new Promise(resolve=>setTimeout(resolve,5));return response({status:'success',data:{url:landing,title:'456'}});}
  return new Promise(()=>{});
 }});
 await assert.rejects(lookup(link),error=>{
  assert.equal(error.code,'PREVIEW_TIMEOUT');
  assert.equal(error.canonicalUrl,canonical);
  assert.equal(error.resolvedUrl,landing);
  return true;
 });
 assert.equal(signal.aborted,true);
 assert.deepEqual(calls,[link,canonical]);
});

test('canonical request failure carries the product URL and is never cached as success',async()=>{
 const calls=[];
 const lookup=tools.createPreviewLookup({fetch:async url=>{
  const target=new URL(url).searchParams.get('url');calls.push(target);
  if(target===link)return response({status:'success',data:{url:landing,title:'456'}});
  throw new TypeError('offline');
 }});
 for(let attempt=0;attempt<2;attempt++){
  await assert.rejects(lookup(link),error=>error.code==='PREVIEW_NETWORK'&&error.canonicalUrl===canonical&&error.resolvedUrl===landing);
 }
 assert.deepEqual(calls,[link,canonical,link,canonical]);
});

test('direct canonical product IDs remain available when preview fails before resolving',async()=>{
 const direct='https://shopee.com.br/Meu-produto-i.123.456?affiliate=kept';
 const lookup=tools.createPreviewLookup({fetch:async()=>response({},429)});
 await assert.rejects(lookup(direct),error=>error.code==='PREVIEW_LIMIT'&&error.canonicalUrl===canonical);
 assert.equal(tools.canonicalProductUrl('https://shopee.com.br.evil.example/opaanlp/123/456'),'');
 assert.equal(tools.canonicalProductUrl('https://shopee.com.br/opaanlp/123/456'),canonical);
});

test('canonical follow preserves the landing photo and missing name while keeping canonical price authoritative',async()=>{
 for(const [priceText,expectedPrice] of [['R$ 129,90',129.9],['R$ 100 a R$ 150',null]]){
  const calls=[];
  const lookup=tools.createPreviewLookup({fetch:async url=>{
   const target=new URL(url).searchParams.get('url');calls.push(target);
   if(target===link)return response({status:'success',data:{url:landing,title:'Fone Bluetooth Pro',image:{url:'https://cdn.example/front.jpg'},images:['https://cdn.example/front.jpg','https://cdn.example/back.jpg'],priceMeta:'99.90',currencyMeta:'BRL'}});
   return response({status:'success',data:{url:canonical,productDescription:'Descrição completa obtida na página do produto.',priceText,currencyMeta:'BRL'}});
  }});
  const info=await lookup(link);
  assert.deepEqual(calls,[link,canonical]);
  assert.equal(info.name,'Fone Bluetooth Pro');
  assert.equal(info.description,'Descrição completa obtida na página do produto.');
  assert.equal(info.image,'https://cdn.example/front.jpg');
  assert.deepEqual(info.images,['https://cdn.example/front.jpg','https://cdn.example/back.jpg']);
  assert.equal(info.price,expectedPrice,'do not restore an outdated or ambiguous landing price');
  assert.equal(info.resolvedUrl,canonical);
 }
});
