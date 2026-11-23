/* Utilities for the link-to-product flow. No account data is sent to preview services. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProductTools = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
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

  function parsePreview(payload) {
    if (payload?.status !== 'success' || !payload?.data) throw previewError('PREVIEW_BLOCKED','A página da Shopee não liberou seus dados. Abra o produto e copie o link completo ou escolha outra foto.');
    const meta = payload.data;
    if (meta.url && !validShopee(meta.url)) throw previewError('PREVIEW_REDIRECT','O link redirecionou para uma página não reconhecida da Shopee.');
    if (isBlockedTitle(meta.title)) throw previewError('PREVIEW_BLOCKED','A página da Shopee não liberou seus dados. Abra o produto e copie o link completo ou escolha outra foto.');
    const candidates = [];
    function addImage(value) {
      if (Array.isArray(value)) { value.slice(0,12).forEach(addImage); return; }
      const url = safeImage(typeof value === 'string' ? value : value?.url);
      if (url && !candidates.includes(url)) candidates.push(url);
    }
    addImage(meta.image);
    addImage(meta.images);
    const name = cleanTitle(meta.title);
    if (!name && !candidates.length) throw previewError('PREVIEW_EMPTY','A página não informou imagem ou título. Cole o link completo do produto ou escolha uma foto.');
    return {name, image:candidates[0] || '', images:candidates.slice(0,8), source:'prévia pública do link', resolvedUrl:meta.url || ''};
  }

  function createPreviewLookup(options = {}) {
    const fetcher = options.fetch || (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null);
    const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(1,options.timeoutMs) : 10000;
    const cacheTtlMs = Number.isFinite(options.cacheTtlMs) ? Math.max(0,options.cacheTtlMs) : 10 * 60 * 1000;
    const now = options.now || Date.now;
    const cache = new Map();
    const pending = new Map();
    async function lookup(link, {force = false} = {}) {
      if (!validShopee(link)) throw previewError('INVALID_LINK','Cole um endereço HTTPS válido da Shopee.');
      if (!fetcher) throw previewError('PREVIEW_UNAVAILABLE','Este navegador não consegue consultar a prévia.');
      const saved = cache.get(link);
      if (!force && saved && now() - saved.at < cacheTtlMs) return {...saved.info,images:[...saved.info.images]};
      if (saved) cache.delete(link);
      if (pending.has(link)) return pending.get(link);
      const task = (async () => {
        const endpoint = new URL('https://api.microlink.io/');
        endpoint.searchParams.set('url',link);
        const controller = new AbortController();
        let timer;
        const timeout = new Promise((_,reject) => {
          timer = setTimeout(() => {
            reject(previewError('PREVIEW_TIMEOUT','A busca da foto demorou demais. Tente novamente ou cole o link completo do produto.'));
            controller.abort();
          },timeoutMs);
        });
        try {
          const request = (async () => {
            let response;
            try { response = await fetcher(endpoint.href,{headers:{Accept:'application/json'},signal:controller.signal,referrerPolicy:'no-referrer'}); }
            catch (error) {
              if (controller.signal.aborted) throw previewError('PREVIEW_TIMEOUT','A busca da foto demorou demais. Tente novamente ou cole o link completo do produto.');
              throw previewError('PREVIEW_NETWORK','Não foi possível buscar a foto. Verifique sua conexão e tente novamente.');
            }
            if (response.status === 429) throw previewError('PREVIEW_LIMIT','O serviço de fotos atingiu o limite temporário. Tente mais tarde ou cole o endereço da foto.');
            if (!response.ok) throw previewError('PREVIEW_BLOCKED','A página da Shopee não liberou a prévia. Cole o link completo do produto ou escolha uma foto.');
            let payload;
            try { payload = await response.json(); }
            catch { throw previewError('PREVIEW_INVALID','O serviço de fotos respondeu de forma inesperada. Tente novamente.'); }
            return parsePreview(payload);
          })();
          const info = await Promise.race([request,timeout]);
          cache.set(link,{at:now(),info});
          while (cache.size > 100) cache.delete(cache.keys().next().value);
          return {...info,images:[...info.images]};
        } finally { clearTimeout(timer); }
      })();
      pending.set(link,task);
      try { return await task; }
      finally { if (pending.get(link) === task) pending.delete(link); }
    }
    lookup.clear = link => link ? cache.delete(link) : cache.clear();
    return lookup;
  }

  return {validShopee,extractShopeeLink,parseSharedProduct,safeImage,parsePrice,cleanTitle,parsePreview,createPreviewLookup};
});
