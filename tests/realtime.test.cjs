'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const repo=path.resolve(__dirname,'..');
const rules=JSON.parse(fs.readFileSync(path.join(repo,'database.rules.json'),'utf8')).rules;
const namespace=rules.shopeePanel.v1;
const app=fs.readFileSync(path.join(repo,'app.js'),'utf8');
const back=fs.readFileSync(path.join(repo,'functions','index.js'),'utf8');
const config=JSON.parse(fs.readFileSync(path.join(repo,'firebase.json'),'utf8'));

test('Firebase CLI aponta para as regras do Realtime Database',()=>{
 assert.equal(config.database.rules,'database.rules.json');
 assert.ok(!('firestore' in config));
});
test('leitura pública limitada às vitrines públicas',()=>{
 assert.equal(rules['.read'],false);
 assert.equal(namespace.publicShops['.read'],true);
 assert.match(namespace.publicProducts.$uid['.read'],/publicShops/);
});
test('escrita de lojas e produtos é vinculada ao UID autenticado',()=>{
 assert.match(namespace.shops.$uid['.write'],/auth\.uid === \$uid/);
 assert.match(namespace.publicShops.$uid['.write'],/auth\.uid === \$uid/);
 assert.match(namespace.publicProducts.$uid.$productId['.write'],/auth\.uid === \$uid/);
});
test('credenciais, relatórios e status são inacessíveis para escrita do navegador',()=>{
 assert.equal(namespace.affiliateSecrets['.read'],false);
 assert.equal(namespace.affiliateSecrets['.write'],false);
 assert.equal(namespace.affiliateReports.$uid['.write'],false);
 assert.equal(namespace.affiliateStatus.$uid['.write'],false);
 assert.match(namespace.affiliateReports.$uid['.read'],/auth\.uid === \$uid/);
});
test('links dos produtos devem usar domínio oficial da Shopee e HTML de usuários é escapado',()=>{
 const v=namespace.publicProducts.$uid.$productId;
 assert.match(v.affiliateUrl['.validate'],/shopee/);
 assert.match(v.originalUrl['.validate'],/shopee/);
 assert.match(v.trackingSource['.validate'],/manual/);
 assert.match(app,/function escapeHtml/);
 assert.match(app,/validShopee/);
});
test('frontend não usa Firestore nem depende da Cloud Function ensureStore',()=>{
 assert.match(app,/firebase-database\.js/);
 assert.match(app,/shopeePanel\/v1/);
 assert.ok(!app.includes('firebase-firestore.js'));
 assert.ok(!app.includes('ensureStore'));
 assert.match(app,/async function saveManualProduct/);
});
test('backend de afiliados utiliza Admin RTDB e não expõe credenciais em regras',()=>{
 assert.match(back,/admin\.database\(\)/);
 assert.ok(!back.includes('admin.firestore'));
 assert.match(back,/defineSecret\('AFFILIATE_ENCRYPTION_KEY'\)/);
});