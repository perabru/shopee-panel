/* Parse public product metadata only. No requests, credentials or affiliate-link rewriting. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ProductPage=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const MAX_JSON=600000;
  const MAX_NODES=500;
  const blocked=/^(?:just a moment(?:\.{3})?|access denied|forbidden|captcha|login|log in|sign in|entrar|fazer login|página não encontrada|page not found|404(?:.*)?|verify (?:that )?you are human|verifique (?:se|que) voc[eê] [eé] humano|security verification|verifica[çc][aã]o de seguran[çc]a)(?:\s*[|–—-]\s*Shopee(?: Brasil)?)?\s*$/i;

  function isBlocked(value){
    const text=cleanText(value,350).replace(/\s*[|–—-]\s*Shopee(?: Brasil)?\s*$/i,'').trim();
    return blocked.test(text)||/^(?:tente novamente mais tarde[.!]?|(?:a )?verifica[çc][aã]o falhou(?:[.!]\s*tente novamente (?:em alguns minutos|mais tarde)[.!]?)?|verification failed(?:[.!]\s*please try again later[.!]?)?|unable to verify(?:[.!]\s*please try again later[.!]?)?)$/i.test(text);
  }

  function scalar(value){
    if(Array.isArray(value))return scalar(value.find(v=>typeof v==='string'||typeof v==='number'));
    return typeof value==='string'||typeof value==='number'?String(value):'';
  }
  function decodeEntities(value){
    const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',hellip:'…',rsquo:'’',lsquo:'‘',ldquo:'“',rdquo:'”',times:'×'};
    return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi,(match,entity)=>{
      if(entity[0]!=='#')return named[entity.toLowerCase()]??match;
      const code=entity[1]?.toLowerCase()==='x'?parseInt(entity.slice(2),16):Number(entity.slice(1));
      return Number.isInteger(code)&&code>0&&code<=0x10ffff&&!(code>=0xd800&&code<=0xdfff)?String.fromCodePoint(code):' ';
    });
  }
  function cleanText(value,max=350){
    let text=scalar(value).slice(0,12000);
    for(let i=0;i<2;i++)text=decodeEntities(text);
    return text.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ')
      .replace(/<[^>]*>/g,' ').replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').replace(/\s+([.,!?;:])/g,'$1').trim().slice(0,max);
  }
  function cleanName(value){
    const name=cleanText(value,220).replace(/\s*[|–—-]\s*Shopee(?: Brasil)?\s*$/i,'').trim();
    const pseudo=/^(?:https?:\/\/|(?:\d+|[a-z\d_-]{1,24})\?(?:__mobile__|exp_group|gads_|utm_|af_|aff_|smtt|sp_atk|xptdk)=|\d+(?:[./]\d+)*$)/i.test(name)||/^[^\s?]+\?[^\s]*[=&]/.test(name);
    return !name||pseudo||isBlocked(name)||/^Shopee(?: Brasil)?(?:\s*[|–—-].*)?$/i.test(name)?'':name.slice(0,180);
  }
  function cleanDescription(value){
    const text=cleanText(value,350);
    if(!text||isBlocked(text))return '';
    if(/^(?:Shopee(?: Brasil)?\s*(?:é|:|[-–—|])|Compre (?:e venda|online|produtos)\b|Baixe o (?:app|aplicativo) (?:da )?Shopee\b|A Shopee é\b|Encontre (?:milhares|milhões|as melhores)\b)/i.test(text))return '';
    if(/^(?:fa[çc]a login|entre na sua conta|verifique (?:se|que) voc[eê] [eé] humano|complete (?:a |o )?verifica[çc][aã]o)/i.test(text))return '';
    return text;
  }
  function safeImage(value){
    const raw=typeof value==='string'?value:value?.url||value?.contentUrl||'';
    if(typeof raw!=='string'||raw.length>1400||/[\x00-\x1f]/.test(raw))return '';
    try{const url=new URL(raw);return url.protocol==='https:'&&!url.username&&!url.password&&!url.port?url.href:'';}catch{return '';}
  }
  function types(node){return (Array.isArray(node?.['@type'])?node['@type']:[node?.['@type']]).filter(x=>typeof x==='string').map(x=>x.split(/[\/#]/).pop());}
  function productId(url){
    try{const u=new URL(url);const m=u.pathname.match(/(?:-i\.|\/(?:product|opaanlp)\/)(\d+)[./](\d+)(?:\/|$)/i);if(m)return m[1]+':'+m[2];const a=u.searchParams.get('shopid'),b=u.searchParams.get('itemid');return /^\d+$/.test(a||'')&&/^\d+$/.test(b||'')?a+':'+b:'';}catch{return '';}
  }
  function urlMatches(a,b){
    const aid=productId(a),bid=productId(b);if(aid&&bid)return aid===bid;
    try{const x=new URL(a),y=new URL(b);return x.origin===y.origin&&x.pathname.replace(/\/$/,'')===y.pathname.replace(/\/$/,'');}catch{return false;}
  }
  function normalName(value){return cleanName(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z\d]+/g,' ').trim();}
  function jsonProducts(input){
    const values=Array.isArray(input)?input.slice(0,30):[input];
    const found=[];let visited=0;
    function visit(node,depth=0,main=false){
      if(!node||depth>12||++visited>MAX_NODES)return;
      if(Array.isArray(node)){node.slice(0,80).forEach(x=>visit(x,depth+1,main));return;}
      if(typeof node!=='object')return;
      if(types(node).some(t=>t==='Product'||t==='ProductGroup'))found.push({node,main});
      for(const [key,value] of Object.entries(node)){
        if(key==='offers'||key==='review'||key==='aggregateRating'||key==='image')continue;
        if(value&&typeof value==='object')visit(value,depth+1,main||key==='mainEntity');
      }
    }
    for(let value of values){
      if(typeof value==='string'){
        if(value.length>MAX_JSON)continue;
        try{value=JSON.parse(value.replace(/^\s*<!--|-->\s*$/g,''));}catch{continue;}
      }
      visit(value);
    }
    return found;
  }
  function selectProduct(entries,meta){
    if(!entries.length)return null;
    const title=normalName(meta.pageTitle||meta.title);
    const target=scalar(meta.url);
    const targetId=productId(target);
    const scored=entries.flatMap(entry=>{
      const node=entry.node;
      const urls=[node.url,node['@id'],node.mainEntityOfPage?.['@id'],node.mainEntityOfPage].filter(x=>typeof x==='string');
      const absoluteUrls=urls.map(u=>{try{return new URL(u,target).href;}catch{return u;}});
      // Explicit product identity always wins over titles, mainEntity markers and candidate count.
      // A sole recommendation must never become the requested product merely because it is alone.
      if(targetId&&absoluteUrls.some(u=>{const id=productId(u);return id&&id!==targetId;}))return [];
      const exactUrl=target&&absoluteUrls.some(u=>urlMatches(u,target));
      const name=normalName(node.name);
      const exactName=title&&name&&title===name;
      const closeName=title.length>=12&&name.length>=12&&(title.includes(name)||name.includes(title));
      return [{...entry,score:exactUrl?100:exactName?70:closeName?45:entry.main?20:0}];
    }).sort((a,b)=>b.score-a.score);
    if(!scored.length)return null;
    if(scored.length===1)return entries.length===1||scored[0].score>0?scored[0].node:null;
    if(scored[0].score>0&&scored[0].score>scored[1].score)return scored[0].node;
    // Duplicate declarations of the same item are common; don't arbitrarily choose differing offers.
    if(scored[0].score>0&&scored.every(x=>JSON.stringify(x.node)===JSON.stringify(scored[0].node)))return scored[0].node;
    return null;
  }
  function currency(value){const text=scalar(value).trim().toUpperCase();return text==='R$'?'BRL':text;}
  function money(value,machine=false){
    if(value==null||value==='')return null;
    let n;
    if(typeof value==='number')n=value;
    else{
      let text=cleanText(value,80).replace(/^R\$\s*/i,'').trim();
      if(machine&&/^\d+\.\d{3,}$/.test(text))return null;
      if(machine&&/^\d+(?:\.\d{1,2})?$/.test(text))n=Number(text);
      else{
        if(/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(text))text=text.replace(/\./g,'').replace(',','.');
        else if(/^\d+(?:,\d{1,2})?$/.test(text))text=text.replace(',','.');
        else if(!/^\d+(?:\.\d{1,2})?$/.test(text))return null;
        n=Number(text);
      }
    }
    return Number.isFinite(n)&&n>=0&&n<=1e8?Math.round((n+Number.EPSILON)*100)/100:null;
  }
  function unsuitablePrice(node){
    if(node?.billingDuration||node?.billingIncrement||node?.billingStart)return true;
    return /(?:strikethrough|listprice|originalprice|msrp|recommendedretail|installment|monthly|parcel|por m[eê]s|comiss[aã]o|desconto)/i.test([node?.priceType,node?.name,node?.billingDuration,node?.billingIncrement].filter(Boolean).join(' '));
  }
  function offerPrice(offers,fallbackCurrency){
    const all=Array.isArray(offers)?offers.slice(0,50):[offers];
    const prices=[];let range=false,foreign=false,unknownCurrency=false,hadOffer=false;
    for(const offer of all){
      if(!offer||typeof offer!=='object'||unsuitablePrice(offer))continue;
      hadOffer=true;
      const curr=currency(offer.priceCurrency)||fallbackCurrency;
      if(curr&&curr!=='BRL'){foreign=true;continue;}
      if(!curr){unknownCurrency=true;continue;}
      const low=money(offer.lowPrice,true),high=money(offer.highPrice,true);
      if(low!==null||high!==null){
        if(low!==null&&high!==null&&low===high)prices.push(low);
        else range=true;
        continue;
      }
      let price=money(offer.price,true);
      if(price===null){
        const specs=(Array.isArray(offer.priceSpecification)?offer.priceSpecification:[offer.priceSpecification]).filter(x=>x&&typeof x==='object'&&!unsuitablePrice(x));
        const values=specs.flatMap(spec=>{
          const c=currency(spec.priceCurrency)||curr;
          if(c&&c!=='BRL')return [];
          const p=money(spec.price,true);return p===null?[]:[p];
        });
        if(new Set(values).size===1)price=values[0];else if(values.length>1)range=true;
      }
      if(price!==null)prices.push(price);
    }
    const unique=[...new Set(prices)];
    if(range||unique.length>1)return {price:null,note:'O valor varia conforme a opção do produto. Confira a variação na Shopee.',handled:true};
    if(unique.length===1)return {price:unique[0],note:'',handled:true};
    return {price:null,note:foreign?'O preço informado está em outra moeda. Confira o valor em reais na Shopee.':'',handled:(foreign||unknownCurrency)&&hadOffer};
  }
  function parseProductPage(meta={}){
    if(!meta||typeof meta!=='object')meta={};
    const resolvedUrl=scalar(meta.url);
    if(isBlocked(meta.title)||isBlocked(meta.pageTitle)||isBlocked(meta.description)||/\/(?:buyer\/)?(?:login|captcha|verify|security)(?:\/|\?|$)/i.test(resolvedUrl)){
      const error=new Error('A página da Shopee não liberou os dados do produto.');error.code='PREVIEW_BLOCKED';throw error;
    }
    const entries=jsonProducts(meta.productJsonLd);
    const product=selectProduct(entries,meta);
    const name=cleanName(product?.name)||cleanName(meta.pageTitle)||cleanName(meta.title);
    const description=cleanDescription(product?.description)||cleanDescription(meta.productDescription)||cleanDescription(meta.description);
    const images=[];
    function addImages(value){if(Array.isArray(value)){value.slice(0,20).forEach(addImages);return;}const url=safeImage(value);if(url&&!images.includes(url))images.push(url);}
    addImages(product?.image);addImages(meta.image);addImages(meta.images);
    let currencyValue=currency(meta.currencyMeta);
    if(!currencyValue){try{if(/(^|\.)shopee\.com\.br$/i.test(new URL(resolvedUrl).hostname))currencyValue='BRL';}catch{}}
    let price=null,priceNote='',priceSource='';
    // Product groups or variant lists without a single identified item do not imply one fixed price.
    let offers=product?.offers;
    if(!offers&&Array.isArray(product?.hasVariant))offers=product.hasVariant.flatMap(v=>Array.isArray(v?.offers)?v.offers:[v?.offers]);
    const fromOffer=offerPrice(offers,currencyValue);
    if(product&&fromOffer.handled){price=fromOffer.price;priceNote=fromOffer.note;priceSource=price!==null?'dados estruturados do produto':'';}
    else if(entries.length>1&&!product){priceNote='Há mais de um produto na página. Confira o preço do item antes de salvar.';}
    else{
      const ownCurrency=currency(meta.currencyMeta)||currencyValue;
      if(!ownCurrency)priceNote='A página não informou a moeda do preço. Confira o valor em reais na Shopee.';
      else if(ownCurrency!=='BRL')priceNote='O preço informado está em outra moeda. Confira o valor em reais na Shopee.';
      else{
        const raw=scalar(meta.priceMeta)||scalar(meta.priceText);
        price=money(raw,!!scalar(meta.priceMeta));
        if(price!==null)priceSource=scalar(meta.priceMeta)?'preço informado pela página':'preço visível do produto';
        else if(raw)priceNote='A página não informou um preço único. Confira o valor na Shopee.';
      }
    }
    return {name,description,image:images[0]||'',images:images.slice(0,8),price,currency:price!==null?'BRL':currencyValue||'',priceNote,priceSource,source:'página do produto',resolvedUrl};
  }
  return {parseProductPage,cleanDescription};
});
