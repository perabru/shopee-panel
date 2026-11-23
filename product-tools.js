/* Utilities for the link-to-product flow. No account data is sent to preview services. */
(function (root, factory) {
  'use strict';
  const page = typeof module === 'object' && module.exports ? require('./product-page') : root.ProductPage;
  const api = factory(page);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProductTools = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (productPage) {
  'use strict';
  const MAX_LINK_LENGTH = 1200;
  const MAX_IMAGE_LENGTH = 1400;
  const SHOPEE_HOST = /(^|\.)(shopee\.com\.br|shopee\.com|shp\.ee|shope\.ee)$/i;

  function validShopee(value) {
    if (typeof value !== 'string' || !value || value.length > MAX_LINK_LENGTH || /[\s\\\x00-\x1f]/.test(value)) return false;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && SHOPEE_HOST.test(url.hostname) && !url.username && !url.password && !url.port;
    } catch { return false; }
  }

  function extractShopeeLink(value) {
    const text = String(value ?? '').trim();
    // The exact URL is retained, including the affiliate query string and fragment.
    // A standalone URL may legitimately end in punctuation; never rewrite it.
    if (validShopee(text)) return text;
    const candidates = text.match(/https:\/\/[^\s<>"“”‘’]+/gi) || [];
    for (const candidate of candidates) {
      // Shared messages often wrap URLs in Markdown, parentheses or sentence punctuation.
      const link = candidate.replace(/[\])}>.,!?:;'”’]+$/g, '');
      if (validShopee(link)) return link;
    }
    return '';
  }

  function safeImage(value) {
    if (typeof value !== 'string' || !value || value.length > MAX_IMAGE_LENGTH || /[\x00-\x1f]/.test(value)) return '';
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password && !url.port ? url.href : '';
    } catch { return ''; }
  }

  function parsePrice(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    let amount;
    if (typeof value === 'number') amount = value;
    else {
      let text = String(value).trim().replace(/^R\$\s*/i, '').trim();
      if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(text)) text = text.replace(/\./g, '').replace(',', '.');
      else if (/^\d+(?:,\d{1,2})?$/.test(text)) text = text.replace(',', '.');
      else if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error('Preço inválido. Use, por exemplo, 129,90.');
      amount = Number(text);
    }
    if (!Number.isFinite(amount) || amount < 0 || amount > 1e8) throw new Error('Preço inválido. Use, por exemplo, 129,90.');
    return Math.round((amount + Number.EPSILON) * 100) / 100;
  }

  function parseSharedProduct(value) {
    const text = String(value ?? '').replace(/\s+/g,' ').trim();
    const url = extractShopeeLink(value);
    const result = {url,name:'',price:null};
    if (!url) return result;
    // Only standard, explicit share-copy patterns provide a suggested title.
    // Free-form slogans and link slugs are deliberately left for the user to name.
    const named = text.match(/^(?:Confira|Veja)\s+(.{3,180}?)\s+por(?: apenas)?\s+R\$/i)
      || text.match(/^Confira\s+(.{3,180}?)\s+com\s+\d+(?:[.,]\d+)?%\s+de\s+desconto[!.]?\s+(?:Somente|Por(?: apenas)?)\s+R\$/i);
    if (named) {
      const name = cleanTitle(named[1].replace(/^["“”']+|["“”']+$/g,''));
      if (/[a-zà-ÿ]/i.test(name) && !/https?:|R\$|\b(?:compre agora|clique aqui)\b/i.test(name)
        && !/^(?:essa?s? ofertas?|esse?s? produtos?|o produto|promo[çc][aã]o|oferta|aproveite|achadinhos)$/i.test(name)) result.name = name;
    }
    // More than one currency amount usually means an old/new price or a range.
    if ((text.match(/R\$/gi) || []).length === 1 && !/(?:a partir de|at[eé])\s+R\$/i.test(text)) {
      const amount = /R\$\s*(\d[\d.,]*)/i.exec(text);
      if (amount) {
        const tail = text.slice(amount.index + amount[0].length);
        const range = /^\s*(?:(?:a|at[eé])\s+|[-–—]\s*)(?:R\$\s*)?\d/i.test(tail);
        if (!range && !/^[a-zà-ÿ]/i.test(tail)) {
          try { result.price = parsePrice(amount[1].replace(/[.,]+$/,'')); } catch { /* Leave invalid prices blank. */ }
        }
      }
    }
    return result;
  }

  function cleanTitle(value) {
    const text = String(value ?? '').replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0,220);
    if (isBlockedTitle(text)) return '';
    const title = text.replace(/\s*([|–—-])\s*Shopee(?: Brasil)?\s*$/i, '').trim();
    if (/^(?:https?:\/\/|\d+(?:[./]\d+)*$)/i.test(title)||/^[^\s?]+\?[^\s]*[=&]/.test(title)) return '';
    if (!title || /^Shopee(?: Brasil)?(?:\s*[|–—-].*)?$/i.test(title)) return '';
    return title.slice(0,180);
  }

  function isBlockedTitle(value) {
    return /^(?:just a moment(?:\.{3})?|access denied|forbidden|captcha|login|log in|sign in|entrar|fazer login|página não encontrada|page not found|404(?:.*)?|verify (?:that )?you are human|verifique (?:se|que) voc[eê] [eé] humano|security verification|verifica[çc][aã]o de seguran[çc]a)(?:\s*[|–—-]\s*Shopee(?: Brasil)?)?\s*$/i.test(String(value || '').trim());
  }

  function previewError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function trustedPageUrl(value) {
    if (typeof value !== 'string' || !value || value.length > 8192 || /[\s\\\x00-\x1f]/.test(value)) return false;
    try { const u = new URL(value); return u.protocol==='https:' && SHOPEE_HOST.test(u.hostname) && !u.username && !u.password && !u.port; } catch { return false; }
  }

  function canonicalProductUrl(value) {
    if (!trustedPageUrl(value)) return '';
    const url = new URL(value);
    // This is for reading the product only. The original affiliate URL stays untouched.
    if (!/(^|\.)shopee\.com\.br$/i.test(url.hostname)) return '';
    const match = url.pathname.match(/(?:-i\.|\/(?:product|opaanlp)\/)(\d{1,20})[./](\d{1,20})(?:\/|$)/i);
    const shop = match?.[1] || url.searchParams.get('shopid');
    const item = match?.[2] || url.searchParams.get('itemid');
    return /^\d{1,20}$/.test(shop||'') && /^\d{1,20}$/.test(item||'') ? `https://shopee.com.br/product/${shop}/${item}` : '';
  }

  function parsePreview(payload) {
    if (payload?.status !== 'success' || !payload?.data) throw previewError('PREVIEW_BLOCKED','A página da Shopee não liberou seus dados. Confira o produto na loja e complete os campos que faltam.');
    const meta = payload.data;
    if (meta.url && !trustedPageUrl(meta.url)) throw previewError('PREVIEW_REDIRECT','O link redirecionou para uma página não reconhecida da Shopee.');
    if ([401,403,429].includes(Number(payload.statusCode))) throw previewError('PREVIEW_BLOCKED','A Shopee restringiu a leitura desta página. Confira o produto na loja e complete os campos que faltam.');
    if (Number(payload.statusCode)>=400) throw previewError('PREVIEW_UNAVAILABLE','A página do produto está indisponível no momento.');
    const info = productPage.parseProductPage(meta);
    if (!info.name && !info.image && !info.description && info.price==null) throw previewError('PREVIEW_EMPTY','A página não informou foto, preço ou descrição do produto para leitura automática. Confira na Shopee e complete os campos que faltam.');
    return {...info, canonicalUrl:canonicalProductUrl(meta.url)};
  }

  function extractionEndpoint(link) {
    const endpoint = new URL('https://api.microlink.io/');
    endpoint.searchParams.set('url',link);
    endpoint.searchParams.set('prerender','true');
    const rules = {
      productJsonLd:{selectorAll:'script[type="application/ld+json"]',attr:'text'},
      pageTitle:{selector:'h1',attr:'text'},
      productDescription:{selector:'[itemprop="description"]',attr:'text'},
      priceMeta:{selector:'meta[property="product:price:amount"],meta[property="og:price:amount"],meta[itemprop="price"],meta[property="shopee:price"]',attr:'content'},
      currencyMeta:{selector:'meta[property="product:price:currency"],meta[property="og:price:currency"],meta[itemprop="priceCurrency"]',attr:'content'},
      priceText:{selector:'[itemprop="price"]',attr:'text'}
    };
    for (const [field,rule] of Object.entries(rules)) for (const [key,value] of Object.entries(rule)) endpoint.searchParams.set(`data.${field}.${key}`,value);
    return endpoint.href;
  }

  function createPreviewLookup(options = {}) {
    const fetcher = options.fetch || (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null);
    const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(1,options.timeoutMs) : 30000;
    const cacheTtlMs = Number.isFinite(options.cacheTtlMs) ? Math.max(0,options.cacheTtlMs) : 5 * 60 * 1000;
    const now = options.now || Date.now;
    const cache = new Map();
    const pending = new Map();
    const clone = info => ({...info,images:[...info.images]});
    async function lookup(link, {force = false} = {}) {
      if (!validShopee(link)) throw previewError('INVALID_LINK','Cole um endereço HTTPS válido da Shopee.');
      if (!fetcher) throw previewError('PREVIEW_UNAVAILABLE','Este navegador não consegue consultar a página.');
      const saved = cache.get(link);
      if (!force && saved && now() - saved.at < cacheTtlMs) return clone(saved.info);
      if (saved) cache.delete(link);
      if (pending.has(link)) return clone(await pending.get(link));
      const task = (async () => {
        const controller = new AbortController();
        let timer, resolvedUrl='', canonicalUrl=canonicalProductUrl(link);
        const annotate = error => Object.assign(error,{resolvedUrl,canonicalUrl});
        const timeoutError = () => annotate(previewError('PREVIEW_TIMEOUT','A leitura da página demorou demais. Tente novamente ou complete os campos do produto.'));
        const timeout = new Promise((_,reject) => {
          timer = setTimeout(() => { reject(timeoutError()); controller.abort(); },timeoutMs);
        });
        async function read(url) {
          let response;
          try { response = await fetcher(extractionEndpoint(url),{headers:{Accept:'application/json'},signal:controller.signal,referrerPolicy:'no-referrer'}); }
          catch {
            if (controller.signal.aborted) throw timeoutError();
            throw previewError('PREVIEW_NETWORK','Não foi possível ler a página. Verifique sua conexão e tente novamente.');
          }
          if (response.status === 429) throw previewError('PREVIEW_LIMIT','O serviço de leitura atingiu o limite temporário. Tente mais tarde ou preencha os dados manualmente.');
          if (!response.ok) throw previewError('PREVIEW_UNAVAILABLE','O serviço de leitura não conseguiu consultar a página. Tente novamente mais tarde.');
          let payload;
          try { payload = await response.json(); }
          catch { throw previewError('PREVIEW_INVALID','O serviço de leitura respondeu de forma inesperada. Tente novamente.'); }
          resolvedUrl=trustedPageUrl(payload?.data?.url)?payload.data.url:resolvedUrl;
          canonicalUrl=canonicalProductUrl(resolvedUrl)||canonicalUrl;
          return parsePreview(payload);
        }
        try {
          const request = (async () => {
            let first=null, firstError=null;
            try { first=await read(link); } catch(error) { firstError=error; }
            // A landing redirect can identify the item without exposing product data.
            // Never retry a login, security challenge, denial, or service error.
            const intermediate = trustedPageUrl(resolvedUrl) && /^\/opaanlp\//i.test(new URL(resolvedUrl).pathname);
            const canFollow = canonicalUrl && canonicalUrl!==link && (firstError?.code==='PREVIEW_EMPTY' || (!firstError && intermediate && (!first.name||!first.image||first.price==null||!first.description)));
            if (canFollow) {
              try {
                const detail=await read(canonicalUrl);
                if (!first) return detail;
                const images=[...new Set([...detail.images,...first.images])].slice(0,8);
                return {...detail,name:detail.name||first.name,description:detail.description||first.description,image:detail.image||first.image,images};
              }
              catch(error) { if (!first) throw error; return {...first,readNote:error.message}; }
            }
            if (firstError) throw firstError;
            return first;
          })();
          const info = await Promise.race([request,timeout]);
          cache.set(link,{at:now(),info});
          while (cache.size > 100) cache.delete(cache.keys().next().value);
          return clone(info);
        } catch(error) { throw annotate(error); }
        finally { clearTimeout(timer); }
      })();
      pending.set(link,task);
      try { return clone(await task); }
      finally { if (pending.get(link) === task) pending.delete(link); }
    }
    lookup.clear = link => link ? cache.delete(link) : cache.clear();
    return lookup;
  }

  return {validShopee,extractShopeeLink,parseSharedProduct,safeImage,parsePrice,cleanTitle,canonicalProductUrl,parsePreview,createPreviewLookup};
});
