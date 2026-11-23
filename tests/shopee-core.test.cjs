'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const core = require('../functions/shopee-core.js');
const secret='a'.repeat(64);
test('Shopee HMAC: assinatura de parceiro e loja',()=>{
  const timestamp=1770000000,path='/api/v2/product/get_item_list';
  const expected=crypto.createHmac('sha256','partner-secret').update('123'+path+timestamp+'token123'+'1234').digest('hex');
  assert.equal(core.signShopee({partnerId:123,partnerKey:'partner-secret',path,timestamp,accessToken:'token123',shopId:'1234'}),expected);
});
test('Authorization URL oficial inclui state e redirecionamento',()=>{
  const url=new URL(core.makeAuthorizationUrl({partnerId:'123',redirectUrl:'https://site.test/callback',state:'a'.repeat(64)}));
  assert.equal(url.hostname,'open.shopee.com.br');assert.equal(url.searchParams.get('auth_type'),'seller');assert.equal(url.searchParams.get('state'),'a'.repeat(64));
});
test('Tokens são criptografados AES-256-GCM e não expostos em texto',()=>{
  const original={access_token:'test-access',refresh_token:'refresh',expires_at:2099000000000};
  const encrypted=core.encryptToken(original,secret);assert.ok(!encrypted.includes('test-access'));
  assert.deepEqual(core.decryptToken(encrypted,secret),original);
  assert.throws(()=>core.decryptToken(encrypted,'b'.repeat(64)));
});
test('Receitas nunca inventam valores ausentes',()=>{
  assert.deepEqual(core.normalizeIncomeOverview({response:{pending_amount:200,released_amount:380}}),{pending_amount:200,released_amount:380,to_release_amount:null});
  assert.equal(core.normalizeIncomeOverview({response:{}}).pending_amount,null);
});
test('Valida publicação e rejeita campos obrigatórios faltantes',()=>{
  const body={item_name:'Organizador para gavetas',description:'Kit multiuso resistente para gavetas e cozinha.',category_id:123,original_price:55.40,
    weight:0.2,condition:'NEW',item_status:'NORMAL',image:{image_id_list:['photo_12345']},seller_stock:[{stock:20}],dimension:{package_length:10,package_width:20,package_height:15},logistic_info:[{logistic_id:1234,enabled:true}]};
  const parsed=core.validateProduct(body);assert.equal(parsed.item_name,body.item_name);assert.equal(parsed.seller_stock[0].stock,20);
  assert.throws(()=>core.validateProduct({...body,image:{image_id_list:[]}}),/imagens/);
  assert.throws(()=>core.validateProduct({...body,original_price:-1}),/preço/);
});