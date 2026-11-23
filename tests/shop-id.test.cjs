'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').replace(/^import\s+.*?;\s*$/gm,'');
const env={
 URL,console,Date,Math,Number,String,Intl,encodeURIComponent,
 initializeApp:()=>({}),getAuth:()=>({}),getDatabase:()=>({}),getFunctions:()=>({}),
 onAuthStateChanged:()=>{},ref:()=>({}),document:{getElementById:()=>({innerHTML:'',addEventListener(){}}),addEventListener(){}},
 window:{addEventListener(){}},location:{hash:'#/',href:'https://perabru.github.io/shopee-panel/'},setTimeout:()=>0,clearTimeout:()=>{},
};
const context=vm.createContext(env);vm.runInContext(fs.readFileSync(path.join(__dirname,'../product-tools.js'),'utf8'),context);vm.runInContext(source,context);
const detect=url=>JSON.parse(JSON.stringify(vm.runInContext(`detectShopFromLink(${JSON.stringify(url)})`,context)));
test('URL com /shop/NUMERO devolve o ID numerico visivel',()=>{
 assert.deepEqual([detect('https://shopee.com.br/shop/123456789').kind,detect('https://shopee.com.br/shop/123456789').id],['id','123456789']);
 assert.equal(detect('https://shopee.com.br/loja?shopid=987654321').id,'987654321');
});
test('link de perfil fornecido nao e declarado ID numerico',()=>{
 const result=detect('https://shopee.com.br/q63ifc2_ce');
 assert.equal(result.kind,'profile');assert.equal(result.profile,'q63ifc2_ce');
 assert.ok(!result.id);
});
test('URLs maliciosas e links curtos sem numero nao geram ID ficticio',()=>{
 assert.equal(detect('https://shopee.com.br.evil.example/shop/123').kind,'invalid');
 assert.equal(detect('javascript:alert(1)').kind,'invalid');
 assert.equal(detect('https://shp.ee/link-curto').kind,'unknown');
});
test('guia explica ID da loja, App ID e caminhos oficiais',()=>{
 const html=vm.runInContext('shopIdGuide()',context);
 assert.match(html,/ID da loja Shopee/);assert.match(html,/App ID/);
 assert.match(html,/q63ifc2_ce/);assert.match(html,/Link de Conversão/);
});