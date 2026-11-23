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
