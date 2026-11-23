'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const c=require('../functions/affiliate-core');
test('Shopee URLs allowed; evil redirects denied',()=>{
 for(const url of ['https://shopee.com.br/q63ifc2_ce','https://br.shp.ee/abcdefgh','https://s.shopee.com.br/3ABC','https://shope.ee/ABC'])assert.ok(c.shopeeUrl(url).startsWith('https'));
 for(const url of ['https://shopee.com.br.evil.com','http://shopee.com.br','javascript:alert(1)','https://evil.com','https://name:pass@shopee.com.br/'])assert.throws(()=>c.shopeeUrl(url));
});
test('Signature is SHA256 of exact app + timestamp + body + secret',()=>{
 const app='42',ts=1730000000,payload='{"query":"{hello}"}',s='abc';
 assert.equal(c.signature(app,s,payload,ts),'755dddc58fcd7fdd0212cbff4a9b094c6b3e7f4638ce700398203738c0234e9f');
});
test('AES-GCM encryption roundtrip and rejects tampering',()=>{
 const key='8'.repeat(64),a=c.encrypt('segredo api',key);
 assert.equal(c.decrypt(a,key),'segredo api');
 assert.throws(()=>c.decrypt(a.slice(0,-3)+'ABC',key));
});
test('GraphQL escapes search values, uses only validated Shopee URLs',()=>{
 const q=c.queryOffers('fone "premium"\n',2);
 assert.ok(q.includes('fone \\"premium\\"\\n'));
 assert.match(c.queryShortLink('https://shopee.com.br/q63ifc2_ce',['shopeepanel']),/generateShortLink/);
 assert.throws(()=>c.queryShortLink('https://other.example','x'));
});
test('Summaries are never a payment balance and separate commissions by status',()=>{
 const r=c.summarizeConversions([
 {conversionId:'1',totalCommission:'12.00',utmContent:'shopeepanel,p1',orders:[{orderStatus:'COMPLETED'}]},
 {conversionId:'2',totalCommission:'5',orders:[{orderStatus:'PENDING'}]},
 {conversionId:'1',totalCommission:'12',orders:[{orderStatus:'COMPLETED'}]},
 ],false);
 assert.equal(r.total,17);assert.equal(r.completed,12);assert.equal(r.pending,5);assert.equal(r.siteTotal,12);assert.equal(r.conversions,2);
});
test('Product data validation and identifiers',()=>{
 assert.equal(c.currencyValue('12.345'),12.35);
 assert.equal(c.category('inexistente'),'Outros');
 assert.equal(c.slugify('Loja São José!'),'loja-sao-jose');
 assert.throws(()=>c.imageUrl('javascript:alert(1)'));
});
test('Offers are normalized and a query cannot inject GraphQL fields',()=>{
 const offer=c.mapOffer({itemId:'987',shopId:'66',productName:'Produto de teste',productLink:'https://shopee.com.br/product/66/987',imageUrl:'https://down-br.img.susercontent.com/file/abc',priceMin:'99.9',commissionRate:'0.05',shopName:'Exemplo'});
 assert.equal(offer.price,99.9);assert.equal(offer.commissionRate,.05);
 const query=c.queryOffers('x"} mutation{deleteEverything}',1,1);
 assert.ok(query.includes('x\\"} mutation'));
 assert.throws(()=>c.mapOffer({productLink:'https://phishing.example',imageUrl:''}));
});
test('API sends exactly the signed body; GraphQL errors do not produce fake offers',async()=>{
 let captured;
 const fakeFetch=async(url,opts)=>{captured={url,opts};return {ok:true,status:200,json:async()=>({data:{productOfferV2:{nodes:[],pageInfo:{hasNextPage:false}}}})};};
 const q=c.queryOffers('café',1,1);
 const data=await c.callAffiliate({appId:'APP01',secret:'SECRET01',query:q,fetcher:fakeFetch});
 assert.deepEqual(data.productOfferV2.nodes,[]);
 assert.equal(captured.url,c.AFFILIATE_API);
 const ts=Number(captured.opts.headers.Authorization.match(/Timestamp=(\d+)/)[1]);
 assert.equal(captured.opts.headers.Authorization,c.signedHeaders('APP01','SECRET01',captured.opts.body,ts).Authorization);
 await assert.rejects(()=>c.callAffiliate({appId:'APP01',secret:'SECRET01',query:q,fetcher:async()=>({ok:true,status:200,json:async()=>({errors:[{message:'No API Access'}]})})}),/No API Access/);
});
test('Attribution is scoped to the correct store UID marker',()=>{
 const nodes=[{conversionId:'a',totalCommission:8,utmContent:'shopeepanel,owner01',orders:[{orderStatus:'COMPLETED'}]},{conversionId:'b',totalCommission:3,utmContent:'shopeepanel,owner02',orders:[{orderStatus:'COMPLETED'}]}];
 assert.equal(c.summarizeConversions(nodes,false,'owner01').siteTotal,8);
});