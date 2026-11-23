'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseProductPage,cleanDescription}=require('../product-page');
const page='https://shopee.com.br/fone-pro-i.123.456';
const image='https://down-br.img.susercontent.com/file/fone';
function product(extra={}){return {'@type':'Product',name:'Fone Pro',url:page,description:'Fone sem fio com estojo.',image,offers:{'@type':'Offer',price:'129.90',priceCurrency:'BRL'},...extra};}
function parse(node,extra={}){return parseProductPage({url:page,title:'Fone Pro | Shopee Brasil',productJsonLd:[JSON.stringify(node)],...extra});}

test('fills all fields from actual Product JSON-LD in graph/mainEntity',()=>{
 const result=parse({'@graph':[{'@type':'WebPage',mainEntity:product()}]});
 assert.equal(result.name,'Fone Pro');assert.equal(result.description,'Fone sem fio com estojo.');assert.equal(result.price,129.9);assert.equal(result.image,image);assert.equal(result.currency,'BRL');assert.equal(result.priceSource,'dados estruturados do produto');assert.equal(result.resolvedUrl,page);
});
test('JSON-LD product identity excludes recommendations and retains URL query unchanged',()=>{
 const url=page+'?af_siteid=123&aff_trace_key=abc';
 const result=parse([product({url:'https://shopee.com.br/product/99/88',name:'Outro',offers:{price:'9.90'}}),product()],{url});
 assert.equal(result.name,'Fone Pro');assert.equal(result.price,129.9);assert.equal(result.resolvedUrl,url);
});
test('multiple unrelated products do not import arbitrary recommendation prices',()=>{
 const result=parse([product({name:'A',url:'https://shopee.com.br/product/1/2'}),product({name:'B',url:'https://shopee.com.br/product/3/4'})],{title:'Seleção',priceMeta:'8.90'});
 assert.equal(result.price,null);assert.match(result.priceNote,/mais de um produto/);
});
test('unique exact product name disambiguates short URLs',()=>{
 const result=parse([product({name:'Outro'}),product()],{url:'https://s.shopee.com.br/ABC'});
 assert.equal(result.price,129.9);assert.equal(result.name,'Fone Pro');
});
test('sanitizes HTML, entities and control characters and caps descriptions',()=>{
 const result=parse(product({description:'<script>alert(1)</script><p>Som &amp; conforto</p><p>USB&#8209;C &lt;b&gt;rápido&lt;/b&gt;.</p>'}));
 assert.equal(result.description,'Som & conforto USB‑C rápido.');
 assert.equal(cleanDescription('x'.repeat(1000)).length,350);
 assert.equal(cleanDescription('Baixe o app da Shopee e compre hoje'), '');
});
test('merges public metadata when the page has no product schema',()=>{
 const result=parseProductPage({url:page,title:'Fone Pro | Shopee Brasil',description:'Fone dobrável, com cabo removível.',priceMeta:'199.90',currencyMeta:'BRL',image:{url:image}});
 assert.equal(result.price,199.9);assert.equal(result.description,'Fone dobrável, com cabo removível.');assert.equal(result.image,image);
});
test('parses visible Brazilian money and refuses installments, discounts and old/new text',()=>{
 assert.equal(parseProductPage({url:page,priceText:'R$ 1.299,90'}).price,1299.9);
 for(const raw of ['10x de R$ 19,90','De R$ 100 por R$ 80','20% de desconto','R$ 10 - R$ 20','comissão R$ 9,90'])assert.equal(parseProductPage({url:page,priceText:raw}).price,null,raw);
});
test('aggregate and variant ranges are not silently saved as a fixed minimum price',()=>{
 for(const offers of [{lowPrice:'10',highPrice:'20',priceCurrency:'BRL'},[{price:'10',priceCurrency:'BRL'},{price:'20',priceCurrency:'BRL'}]]){
  const r=parse(product({offers}),{priceMeta:'10'});assert.equal(r.price,null);assert.match(r.priceNote,/varia/);
 }
 assert.equal(parse(product({offers:{lowPrice:'10',highPrice:'10'}})).price,10);
 assert.equal(parse(product({offers:[{price:'10'},{price:'10'}]})).price,10);
});
test('foreign currencies and strike-through price specifications are not sale prices',()=>{
 assert.equal(parse(product({offers:{price:'20',priceCurrency:'USD'}})).price,null);
 assert.equal(parseProductPage({url:page,priceMeta:'20',currencyMeta:'USD'}).price,null);
 const r=parse(product({offers:{'@type':'Offer',priceSpecification:[{priceType:'https://schema.org/StrikethroughPrice',price:'200'},{price:'129.90',priceCurrency:'BRL'}]}}));assert.equal(r.price,129.9);
});
test('does not return login or verification imagery as a product',()=>{
 for(const title of ['Login | Shopee Brasil','Security verification','Just a moment...'])assert.throws(()=>parseProductPage({url:page,title,image:{url:image}}),{code:'PREVIEW_BLOCKED'});
 assert.throws(()=>parseProductPage({url:'https://shopee.com.br/buyer/login',title:'Shopee',image}),{code:'PREVIEW_BLOCKED'});
});
test('malformed JSON and unsafe image protocols are ignored without evaluating scripts',()=>{
 const result=parseProductPage({url:page,title:'Fone Pro',productJsonLd:['not JSON','{"__proto__":{"price":1}}'],image:'javascript:alert(1)',images:[{url:image},image,'http://bad.example/a','https://user:secret@bad.example/a']});
 assert.deepEqual(result.images,[image]);assert.equal(result.price,null);assert.equal({}.price,undefined);
});
test('ProductGroup variants with different prices remain unresolved',()=>{
 const r=parse({'@type':'ProductGroup',name:'Fone Pro',hasVariant:[product({offers:{price:'100'}}),product({name:'Fone Pro azul',offers:{price:'150'}})]});
 assert.equal(r.price,null);assert.match(r.priceNote,/varia|mais de um/);
});


test('promotional redirect paths identify products and query-string titles are discarded',()=>{
 const r=parse(product(),{url:'https://shopee.com.br/opaanlp/123/456?__mobile__=1',title:'456?__mobile__=1&exp_group=rollout&gads_t_sig=abc'});
 assert.equal(r.name,'Fone Pro');assert.equal(r.price,129.9);
 for(const title of ['23995018651?__mobile__=1&exp_group=rollout&gads_t_sig=abc','23995018651','https://shopee.com.br/product/123/456','product?shopid=123&itemid=456'])assert.equal(parseProductPage({url:page,title}).name,'',title);
});
test('prices without an explicit currency require a Brazilian resolved page',()=>{
 assert.equal(parseProductPage({url:'https://shopee.com/product/123/456',priceMeta:'129.90'}).price,null);
 assert.equal(parseProductPage({url:page,priceMeta:'129.90'}).price,129.9);
 assert.equal(parseProductPage({url:'https://s.shopee.com.br/AbC',priceMeta:'129.90',currencyMeta:'BRL'}).price,129.9);
 assert.equal(parseProductPage({url:page,priceMeta:'1.299'}).price,null);
 assert.equal(parseProductPage({url:'https://shopee.com/?redirect=https://shopee.com.br/',priceMeta:'129.90'}).price,null);
});


test('a sole explicitly different product cannot override target identity even with matching name',()=>{
 for(const wrong of [
  product({url:'https://shopee.com.br/product/123/999'}),
  product({url:'https://shopee.com.br/opaanlp/999/456'}),
  product({url:'/product/123/999'}),
  product({'@id':'https://shopee.com.br/product/123/999'})
 ]){
  const r=parse(wrong);
  assert.equal(r.price,null);assert.equal(r.image,'');assert.equal(r.description,'');
  assert.equal(r.name,'Fone Pro','only the actual page title remains');
 }
 const main=parse({'@type':'WebPage',mainEntity:product({url:'https://shopee.com.br/product/123/999'})});
 assert.equal(main.price,null);
});
test('explicit mismatches are removed before candidate ranking',()=>{
 const r=parse([product({url:'https://shopee.com.br/product/123/999',offers:{price:'0.01',priceCurrency:'BRL'}}),product({name:'Fone Pro sem fio'})]);
 assert.equal(r.price,129.9);assert.equal(r.name,'Fone Pro sem fio');
});
test('generic retry and failed-verification responses never become a product',()=>{
 for(const title of ['Tente Novamente Mais Tarde','Tente Novamente Mais Tarde | Shopee Brasil','A verificação falhou. Tente novamente em alguns minutos.','Verification failed. Please try again later.'])assert.throws(()=>parseProductPage({url:page,title,image}),{code:'PREVIEW_BLOCKED'});
 assert.throws(()=>parseProductPage({url:page,title:'Shopee',description:'A verificação falhou. Tente novamente em alguns minutos.',image}),{code:'PREVIEW_BLOCKED'});
 assert.throws(()=>parseProductPage({url:'https://shopee.com.br/verify/captcha',title:'Shopee',image}),{code:'PREVIEW_BLOCKED'});
});
